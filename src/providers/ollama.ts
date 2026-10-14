import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class OllamaProvider implements NormalizerProvider {
  public name = 'Ollama';
  private baseUrl: string;
  private model: string;
  private available = true;

  constructor(
    baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: string = process.env.OLLAMA_MODEL || 'llama3.2'
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          format: 'json',
          stream: false
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        }
      );

      if (response.data?.response) {
        return response.data.response.trim();
      }

      throw new NormalizerError('Empty response from Ollama', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      this.available = false;
      throw new NormalizerError(
        error.message || 'Ollama connection failed',
        ErrorType.NETWORK_ERROR,
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

    return `You are an expert AI data normalizer. You extract and convert unstructured text into valid JSON strictly conforming to the Target Schema Template.
Return ONLY raw JSON. No markdown code blocks, no explanations.

RULES:
1. Output ONLY valid, parseable JSON conforming strictly to the template structure.
2. Follow all keys and data types from the template.
3. Coerce numeric strings to numbers if the schema indicates numbers.
4. For missing optional arrays, return [].
5. RELATIONAL REFERENCES: For foreign entity references (e.g. feat in background, books, classId in subclass), return the human-readable NAME of the entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"]). Do NOT generate arbitrary 24-character ObjectIds.${specializedGuide}${localeInstruction}

Target Schema Template:
${JSON.stringify(schema, null, 2)}

Raw Paragraph Text to Normalize:
"""
${text}
"""`;
  }
}
