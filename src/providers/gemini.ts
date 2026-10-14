import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';

import { getTemplate } from '../templates';

export class GeminiProvider implements NormalizerProvider {
  public name = 'Gemini';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(apiKey?: string, model: string = process.env.GEMINI_MODEL || 'gemini-2.5-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
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
      throw new NormalizerError('Gemini API key is required', ErrorType.API_ERROR, this.name);
    }

    try {
      const prompt = this.buildPrompt(text, schema, options);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000
        }
      );

      const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText.trim();
      }

      throw new NormalizerError('Empty response from Gemini API', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      const status = error.response?.status;
      const retryAfter = error.response?.headers?.['retry-after'];
      const responseData = error.response?.data;
      const detailMsg =
        (typeof responseData === 'object'
          ? responseData?.error?.message || responseData?.message
          : responseData) ||
        error.message ||
        'Gemini normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `Gemini rate limit exceeded: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      if (status === 401 || status === 403) {
        throw new NormalizerError('Invalid Gemini API key', ErrorType.API_ERROR, this.name, undefined, error);
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
5. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities. The importing script will resolve the database relationship by matching entity names.
6. Keep descriptions clean and faithful to the source.${specializedGuide}${localeInstruction}

Target Schema Template:
${JSON.stringify(promptSchema, null, 2)}

Raw Paragraph Text to Normalize:
"""
${text}
"""`;
  }
}
