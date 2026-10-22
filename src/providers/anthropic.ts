import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';

import { getTemplate } from '../templates';

export class AnthropicProvider implements NormalizerProvider {
  public name = 'Anthropic';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(apiKey?: string, model: string = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
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
      throw new NormalizerError('Anthropic API key is required', ErrorType.API_ERROR, this.name);
    }

    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model,
          max_tokens: 4096,
          temperature: 0.1,
          system:
            'You are an expert data normalization system. You extract structured data into JSON matching the provided schema template. Respond with ONLY valid JSON, starting with { and ending with }.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: timeoutMs,
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      const content = response.data?.content?.[0]?.text;
      if (content) {
        return content.trim();
      }

      throw new NormalizerError('Empty response from Anthropic', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED' || /timeout/i.test(error.message)) {
        throw new NormalizerError(
          `Anthropic request timed out after ${timeoutMs}ms`,
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
        'Anthropic normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `Anthropic rate limit exceeded: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      if (status === 401) {
        throw new NormalizerError('Invalid Anthropic API key', ErrorType.API_ERROR, this.name, undefined, error);
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

    return `Normalize this text into a JSON object strictly conforming to the schema template.

RULES:
1. Output ONLY valid, parseable JSON.
2. Follow the exact keys and data structure of the Target Schema Template.
3. Extract all values faithfully from the raw text. Coerce numbers to numeric integers/floats if the schema indicates numeric values.
4. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities. The importing script will resolve the database relationship by matching entity names.

Target Schema:
${JSON.stringify(promptSchema, null, 2)}
${specializedGuide}${localeInstruction}

Raw Text:
"""
${text}
"""

Return ONLY the raw JSON object.`;
  }
}
