import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class CohereProvider implements NormalizerProvider {
  public name = 'Cohere';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(apiKey?: string, model: string = process.env.COHERE_MODEL || 'command-r-08-2024') {
    this.apiKey = apiKey || process.env.COHERE_API_KEY;
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
      throw new NormalizerError('Cohere API key is required', ErrorType.API_ERROR, this.name);
    }

    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        'https://api.cohere.com/v2/chat',
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert AI data normalizer. You extract structured data into JSON matching the provided schema template. Output ONLY valid parseable JSON.'
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          timeout: timeoutMs,
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      const messageContent = response.data?.message?.content;
      let textContent = '';
      if (Array.isArray(messageContent) && messageContent.length > 0) {
        textContent = messageContent.map((c: any) => c.text || '').join('');
      } else if (typeof response.data?.text === 'string') {
        textContent = response.data.text;
      }

      if (textContent && textContent.trim().length > 0) {
        return textContent.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
      }

      throw new NormalizerError('Empty response from Cohere', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED' || /timeout/i.test(error.message)) {
        throw new NormalizerError(
          `Cohere request timed out after ${timeoutMs}ms`,
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
          ? responseData?.message || responseData?.error?.message
          : responseData) ||
        error.message ||
        'Cohere normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `Cohere rate limit exceeded: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      if (status === 401) {
        throw new NormalizerError('Invalid Cohere API key', ErrorType.API_ERROR, this.name, undefined, error);
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
5. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity. Do NOT invent random hexadecimal ObjectIds for foreign entities.
6. Keep descriptions clean and faithful to the source.${specializedGuide}

Target Schema Template:
${JSON.stringify(promptSchema, null, 2)}

Raw Paragraph Text to Normalize:
"""
${text}
"""`;
  }
}
