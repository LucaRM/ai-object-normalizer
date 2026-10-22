import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class CustomOpenAIProvider implements NormalizerProvider {
  public id: string;
  public name: string;
  private apiKey?: string;
  private baseUrl: string;
  private model: string;
  private available = true;

  constructor(
    id: string,
    name: string,
    apiKey?: string,
    model: string = 'gpt-4o-mini',
    baseUrl: string = 'https://api.openai.com/v1'
  ) {
    this.id = id.toLowerCase();
    this.name = name || id;
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  isAvailable(): boolean {
    return this.available && (!!this.apiKey || this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1'));
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

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    const timeoutMs = options?.providerTimeoutMs || 15000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const endpoint = this.baseUrl.endsWith('/chat/completions')
        ? this.baseUrl
        : `${this.baseUrl}/chat/completions`;

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

      throw new NormalizerError(`Empty response from custom provider "${this.name}"`, ErrorType.API_ERROR, this.name);
    } catch (error: any) {
      if (error instanceof NormalizerError) {
        throw error;
      }

      const status = error.response?.status;
      const errorMsg = error.response?.data?.error?.message || error.message;

      if (status === 401 || status === 403) {
        throw new NormalizerError(`Authentication failed: ${errorMsg}`, ErrorType.API_ERROR, this.name, error);
      }
      if (status === 429) {
        throw new NormalizerError(`Rate limit exceeded: ${errorMsg}`, ErrorType.RATE_LIMIT, this.name, error);
      }

      throw new NormalizerError(`API call failed: ${errorMsg}`, ErrorType.API_ERROR, this.name, error);
    }
  }

  private buildPrompt(text: string, schema: any, options: NormalizeOptions): string {
    let schemaStr = '';
    if (typeof schema === 'string') {
      const tmpl = getTemplate(schema);
      schemaStr = tmpl ? JSON.stringify(tmpl.schema, null, 2) : '{}';
    } else {
      schemaStr = JSON.stringify(schema, null, 2);
    }

    const localeInstruction =
      options.targetLocale && options.targetLocale !== 'none'
        ? `\nTRANSLATION REQUIREMENT: Translate all natural language descriptive texts into "${options.targetLocale}" while keeping keys and technical terms intact.`
        : '';

    return `Extract all relevant entity information from the following text and format it into a JSON object strictly matching this schema.

Target JSON Schema:
${schemaStr}
${localeInstruction}

Source Text:
${text}

Respond ONLY with valid, raw JSON. Do not include markdown code blocks, prefixes, or conversational text.`;
  }
}
