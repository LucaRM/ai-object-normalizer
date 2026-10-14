import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class OVHProvider implements NormalizerProvider {
  public name = 'Free Llama 3.3 70B (OVH)';
  private models: string[];
  private currentModelIndex = 0;
  private available = true;

  constructor(model?: string) {
    this.models = model
      ? [model]
      : ['Meta-Llama-3_3-70B-Instruct', 'Mistral-Nemo-Instruct-2407', 'gpt-oss-20b'];
  }

  isAvailable(): boolean {
    return this.available;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    const prompt = this.buildPrompt(text, schema, options);
    let lastError: any = null;

    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[(this.currentModelIndex + i) % this.models.length];
      try {
        const response = await axios.post(
          'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
          {
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert AI data normalizer. You extract structured data from unstructured text and convert it strictly into a valid JSON object matching the requested schema. Output ONLY valid parseable JSON, no markdown fences, no reasoning, no commentary.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
            max_tokens: 3500
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 25000
          }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (content && typeof content === 'string' && content.trim().length > 0) {
          this.currentModelIndex = (this.currentModelIndex + i) % this.models.length;
          // Strip potential markdown code fences
          return content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
        }

        throw new Error(`Empty response from model ${model}`);
      } catch (err: any) {
        lastError = err;
        console.warn(`[OVHProvider] Model ${model} failed: ${err.message}. Trying next fallback...`);
      }
    }

    if (lastError?.response?.status === 429) {
      this.available = false;
      throw new NormalizerError('OVH rate limit reached, falling back...', ErrorType.RATE_LIMIT, this.name);
    }

    throw new NormalizerError(
      lastError?.message || 'OVH free AI models failed',
      ErrorType.API_ERROR,
      this.name
    );
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
