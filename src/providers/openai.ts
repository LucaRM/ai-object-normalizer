import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';

import { getTemplate } from '../templates';

export class OpenAIProvider implements NormalizerProvider {
  public name = 'OpenAI';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(apiKey?: string, model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
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
      throw new NormalizerError('OpenAI API key is required', ErrorType.API_ERROR, this.name);
    }

    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert AI data normalizer. You extract structured data from unstructured text and convert it into a strictly compliant JSON object based on the user-provided schema template. Output ONLY the JSON object.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
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

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return content.trim();
      }

      throw new NormalizerError('Empty response from OpenAI', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED' || /timeout/i.test(error.message)) {
        throw new NormalizerError(
          `OpenAI request timed out after ${timeoutMs}ms`,
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
        'OpenAI normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `OpenAI rate limit exceeded: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      if (status === 401) {
        throw new NormalizerError('Invalid OpenAI API key', ErrorType.API_ERROR, this.name, undefined, error);
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

    return `Normalize the following raw text into a valid JSON object matching the exact properties and structure of this Target Schema Template.

RULES:
1. Output ONLY valid, parseable JSON.
2. Follow the exact keys and data structure of the Target Schema Template.
3. Extract all values faithfully from the raw text. Coerce numbers to numeric integers/floats if the schema indicates numeric values.
4. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities. The importing script will resolve the database relationship by matching entity names.

Target Schema Template:
${JSON.stringify(promptSchema, null, 2)}
${specializedGuide}${localeInstruction}

Raw Text to Normalize:
"""
${text}
"""`;
  }
}
