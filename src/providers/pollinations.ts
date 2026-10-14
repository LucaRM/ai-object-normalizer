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

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
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
          model: this.model,
          jsonMode: true
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 50000
        }
      );

      // Extract content from OpenAI-compatible response or direct data
      let responseText: any = response.data?.choices?.[0]?.message?.content || response.data;

      if (typeof responseText === 'string') {
        responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
      } else if (typeof responseText === 'object' && responseText !== null) {
        // If Pollinations returned a reasoning wrapper object without entity data
        if (responseText.reasoning && !responseText.name && !responseText.content) {
          throw new NormalizerError(
            'Pollinations returned reasoning tokens without entity content',
            ErrorType.PARSE_ERROR,
            this.name
          );
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

      throw new NormalizerError('Empty response from Pollinations free AI', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new NormalizerError('Pollinations rate limit reached, falling back...', ErrorType.RATE_LIMIT, this.name);
      }
      throw new NormalizerError(
        error.message || 'Pollinations free AI normalization failed',
        ErrorType.API_ERROR,
        this.name
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
1. Output ONLY valid, parseable JSON conforming strictly to the schema structure. Do not output reasoning, thoughts, markdown fences, comments, or conversational text.
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
