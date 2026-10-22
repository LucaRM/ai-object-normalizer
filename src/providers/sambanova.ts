import axios from 'axios';
import { NormalizerProvider, NormalizeOptions, NormalizerError, ErrorType } from '../types';
import { getTemplate } from '../templates';

export class SambaNovaProvider implements NormalizerProvider {
  public name = 'SambaNova';
  private apiKey?: string;
  private model: string;
  private available = true;

  constructor(apiKey?: string, model: string = process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.3-70B-Instruct') {
    this.apiKey = apiKey || process.env.SAMBANOVA_API_KEY;
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
      throw new NormalizerError('SambaNova API key is required', ErrorType.API_ERROR, this.name);
    }

    const timeoutMs = options?.providerTimeoutMs || 12000;
    try {
      const prompt = this.buildPrompt(text, schema, options);

      const response = await axios.post(
        'https://api.sambanova.ai/v1/chat/completions',
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

      throw new NormalizerError('Empty response from SambaNova', ErrorType.API_ERROR, this.name);
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
          `SambaNova request timed out after ${timeoutMs}ms`,
          ErrorType.NETWORK_ERROR,
          this.name,
          undefined,
          error
        );
      }
      const status = error.response?.status;
      const headers = error.response?.headers;
      const retryAfter = headers?.['retry-after'] || headers?.['retry-after-ms'];
      const responseData = error.response?.data;
      const detailMsg =
        (typeof responseData === 'object'
          ? responseData?.error?.message || responseData?.message
          : responseData) ||
        error.message ||
        'SambaNova normalization failed';

      if (status === 429) {
        throw new NormalizerError(
          `SambaNova rate limit reached: ${detailMsg}`,
          ErrorType.RATE_LIMIT,
          this.name,
          retryAfter ? Number(retryAfter) : undefined,
          error
        );
      }
      if (status === 401) {
        throw new NormalizerError('Invalid SambaNova API key', ErrorType.API_ERROR, this.name, undefined, error);
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

    // Clean schema for prompt
    const promptSchema = { ...schema };
    delete (promptSchema as any)._id;
    delete (promptSchema as any).createdAt;
    delete (promptSchema as any).updatedAt;
    delete (promptSchema as any).createdBy;
    delete (promptSchema as any).updatedBy;

    return `Normalize the following raw text into a JSON object matching this schema:
${JSON.stringify(promptSchema, null, 2)}
${specializedGuide}${localeInstruction}

RAW TEXT TO NORMALIZE:
"""
${text}
"""

Output raw valid JSON only:`;
  }
}
