import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class OpenRouterProvider implements NormalizerProvider {
  public name = 'OpenRouter (Free Models)';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(
    apiKey?: string,
    model: string = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
  ) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;
    this.model = model;
  }

  isAvailable(): boolean {
    return this.available && !!this.apiKey;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    if (!this.apiKey) {
      throw new NormalizerError('OpenRouter API key is required', ErrorType.API_ERROR, this.name);
    }

    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI data normalizer. You output ONLY valid, parseable JSON conforming strictly to the schema. Do not output markdown code fences or conversational text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3009',
            'X-Title': 'Object Normalizer'
          },
          timeout: timeoutMs,
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return content.trim();
      }

      throw new NormalizerError('Empty response from OpenRouter API', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED' || /timeout/i.test(error.message)) {
        throw new NormalizerError(
          `OpenRouter request timed out after ${timeoutMs}ms`,
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
        'OpenRouter normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `OpenRouter rate limit reached: ${detailMsg}`,
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

    const localeInstruction = options.targetLocale
      ? `\nCRITICAL LOCALIZATION REQUIREMENT: Also translate the entity into locale "${options.targetLocale}" and populate the translations["${options.targetLocale}"] object with translated fields adhering to the schema's translation structure.`
      : '';

    // Clean schema for prompt to keep it lean and fast
    const promptSchema = { ...schema };
    delete (promptSchema as any)._id;
    delete (promptSchema as any).createdAt;
    delete (promptSchema as any).updatedAt;
    delete (promptSchema as any).createdBy;
    delete (promptSchema as any).updatedBy;
    if (!options.targetLocale) {
      delete (promptSchema as any).translations;
    }

    return `You are an expert AI data normalizer and extractor.
Your task is to take the raw unstructured paragraph of text below and normalize/convert it into a valid JSON object adhering strictly to the properties, types, and structure of the Target Schema Template.

RULES:
1. Output ONLY valid, parseable JSON. Do not write markdown fences, comments, or pleasantries.
2. Follow the exact keys and data structure of the Target Schema Template.
3. Extract all values faithfully from the raw text. Coerce numbers to numeric integers/floats if the schema indicates numeric values.
4. For missing optional arrays, return an empty array [].
5. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities.
6. Keep descriptions clean and faithful to the source.${specializedGuide}${localeInstruction}

Target Schema Template:
${JSON.stringify(promptSchema, null, 2)}

Raw Paragraph Text to Normalize:
"""
${text}
"""`;
  }
}
