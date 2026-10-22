import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class PollinationsProvider implements NormalizerProvider {
  public name = 'Pollinations (Free AI)';
  private model: string;
  private available = true;

  constructor(model: string = process.env.POLLINATIONS_MODEL || 'openai') {
    this.model = model;
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const candidateModels = Array.from(new Set([this.model, 'openai', 'mistral', 'llama', 'deepseek']));
      let lastError: any = null;

      for (const model of candidateModels) {
      try {
        const prompt = this.buildPrompt(text, schema, options);
        const url = 'https://text.pollinations.ai/';

        const response = await axios.post(
          url,
          {
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            model,
            jsonMode: true
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: timeoutMs,
            signal: AbortSignal.timeout(timeoutMs)
          }
        );

        // Extract content from OpenAI-compatible response or direct data
        let responseText: any = response.data?.choices?.[0]?.message?.content || response.data;

        if (typeof responseText === 'string') {
          responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
        } else if (typeof responseText === 'object' && responseText !== null) {
          // If Pollinations returned a reasoning wrapper object without entity data
          if (responseText.reasoning && !responseText.name && !responseText.content) {
            continue; // Try next free model
          }
          if (typeof responseText.content === 'string') {
            responseText = responseText.content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
          } else {
            responseText = JSON.stringify(responseText);
          }
        }

        if (typeof responseText === 'string' && responseText.trim().length > 0) {
          return responseText.trim();
        }
      } catch (err: any) {
        lastError = err;
        // If aborted/timeout, stop looping
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') break;
      }
    }

    if (lastError instanceof NormalizerError) {
      throw lastError;
    }
    throw lastError || new NormalizerError('Empty response from Pollinations free AI models', ErrorType.API_ERROR, this.name);
  } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED' || /timeout/i.test(error.message)) {
        throw new NormalizerError(
          `Pollinations request timed out after ${timeoutMs}ms`,
          ErrorType.NETWORK_ERROR,
          this.name,
          undefined,
          error
        );
      }
      const status = error.response?.status;
      const retryAfter = error.response?.headers?.['retry-after'];
      const responseData = error.response?.data;
      const detailMsg =
        (typeof responseData === 'object'
          ? responseData?.error?.message || responseData?.message
          : responseData) ||
        error.message ||
        'Pollinations free AI normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `Pollinations rate limit reached: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      throw new NormalizerError(
        detailMsg,
        ErrorType.API_ERROR,
        this.name,
        undefined,
        error
      );
    }
  }

  private buildPrompt(text: string, schema: any, options: NormalizeOptions): string {
    const templateDef = options.template ? getTemplate(options.template) : undefined;
    const specializedGuide = templateDef?.promptGuide ? `\n${templateDef.promptGuide}\n` : '';

    // Always keep prompt schema lean to prevent token limit cutoff.
    // Localization is handled via FreeTranslator post-extraction.
    const promptSchema = { ...schema };
    delete (promptSchema as any)._id;
    delete (promptSchema as any).createdAt;
    delete (promptSchema as any).updatedAt;
    delete (promptSchema as any).createdBy;
    delete (promptSchema as any).updatedBy;
    delete (promptSchema as any).translations;

    return `You are an expert AI data normalizer and extractor.
Your task is to take the raw unstructured paragraph of text below and normalize/convert it into a valid JSON object adhering strictly to the properties, types, and structure of the Target Schema Template.

RULES:
1. Output ONLY valid, parseable JSON conforming strictly to the schema structure. Do not output reasoning, thoughts, markdown fences, comments, or conversational text.
2. Follow the exact keys and data structure of the Target Schema Template.
3. Extract all values faithfully from the raw text. Coerce numbers to numeric integers/floats if the schema indicates numeric values.
4. For missing optional arrays, return an empty array [].
5. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities.
6. Keep descriptions clean and faithful to the source.${specializedGuide}

Target Schema Template:
${JSON.stringify(promptSchema, null, 2)}

Raw Paragraph Text to Normalize:
"""
${text}
"""`;
  }
}
