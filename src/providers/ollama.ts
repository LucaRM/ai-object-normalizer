import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class OllamaProvider implements NormalizerProvider {
  public id = 'ollama';
  public name: string;
  private baseUrl: string;
  private model: string;
  private apiKey: string;
  private available = true;

  constructor(
    baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    model: string = process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    apiKey: string = process.env.OLLAMA_API_KEY || 'ollama',
    name: string = 'Local Ollama (Qwen 2.5)'
  ) {
    this.baseUrl = (baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    this.model = model || 'qwen2.5:7b';
    this.apiKey = apiKey || 'ollama';
    this.name = name || 'Local Ollama (Qwen 2.5)';
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = (url || 'http://localhost:11434/v1').replace(/\/+$/, '');
  }

  setApiKey(key: string): void {
    this.apiKey = key || 'ollama';
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    const timeoutMs = options?.providerTimeoutMs || 30000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      // Support baseUrl ending with /v1, without /v1, or with /chat/completions
      let endpoint = this.baseUrl.replace(/\/+$/, '');
      if (endpoint.endsWith('/chat/completions')) {
        // already full endpoint
      } else if (endpoint.endsWith('/v1')) {
        endpoint = `${endpoint}/chat/completions`;
      } else {
        endpoint = `${endpoint}/v1/chat/completions`;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(
        endpoint,
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
          headers,
          timeout: timeoutMs,
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return content.trim();
      }

      // Fallback for native /api/generate response if someone pointed to native endpoint
      if (response.data?.response) {
        return response.data.response.trim();
      }

      throw new NormalizerError('Empty response from Ollama', ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }
      if (
        error.name === 'AbortError' ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ERR_CANCELED' ||
        /timeout/i.test(error.message)
      ) {
        throw new NormalizerError(
          `Ollama request timed out after ${timeoutMs}ms`,
          ErrorType.NETWORK_ERROR,
          this.name,
          undefined,
          error
        );
      }
      if (error.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(error.message)) {
        this.available = false;
        throw new NormalizerError(
          `Ollama unreachable at ${this.baseUrl} (Connection Refused). Ensure Ollama daemon is running.`,
          ErrorType.NETWORK_ERROR,
          this.name,
          10,
          error
        );
      }
      const responseData = error.response?.data;
      const detailMsg =
        (typeof responseData === 'object'
          ? responseData?.error?.message || responseData?.message
          : responseData) ||
        error.message ||
        'Ollama normalization failed';

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
    const promptSchema = typeof schema === 'object' && schema !== null ? { ...schema } : schema;
    if (typeof promptSchema === 'object' && promptSchema !== null) {
      delete (promptSchema as any)._id;
      delete (promptSchema as any).createdAt;
      delete (promptSchema as any).updatedAt;
      delete (promptSchema as any).createdBy;
      delete (promptSchema as any).updatedBy;
      if (!options.targetLocale) {
        delete (promptSchema as any).translations;
      }
    }

    return `Normalize the following raw text into a valid JSON object matching the exact properties and structure of this Target Schema Template.

RULES:
1. Output ONLY valid, parseable JSON conforming strictly to the template structure.
2. Follow all keys and data types from the template.
3. Extract all values faithfully from the raw text. Coerce numbers to numeric integers/floats if the schema indicates numeric values.
4. For missing optional arrays, return [].
5. RELATIONAL FIELDS & FOREIGN REFERENCES: For fields that tie into another entity (such as 'feat' in background, 'books' references, 'classId' in subclass, 'baseItem' in magical items, or spell lists), return the human-readable NAME of the referenced entity (e.g. feat: "Savage Attacker", books: ["Player's Handbook 2024"], classId: "Fighter"). Do NOT invent random hexadecimal ObjectIds for foreign entities. The importing script will resolve the database relationship by matching entity names.${specializedGuide}${localeInstruction}

Target Schema Template:
${typeof promptSchema === 'string' ? promptSchema : JSON.stringify(promptSchema, null, 2)}

Raw Text to Normalize:
"""
${text}
"""`;
  }
}
