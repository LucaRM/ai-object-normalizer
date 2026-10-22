export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class NormalizerError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public provider?: string,
    public retryAfterSeconds?: number,
    public rawError?: any
  ) {
    super(message);
    this.name = 'NormalizerError';
  }
}

export interface NormalizeOptions {
  /**
   * Predefined template name (e.g. 'monster', 'spell', 'item')
   */
  template?: string;

  /**
   * Target locale for embedded translations (e.g. 'pt-BR', 'es')
   */
  targetLocale?: string;

  /**
   * Source text locale (defaults to 'en')
   */
  sourceLocale?: string;

  /**
   * Specific provider to use (skips cascading fallback if set)
   */
  specificProvider?: string;

  /**
   * Default values to enrich the normalized object with
   */
  defaults?: Record<string, any>;

  /**
   * Desired output format:
   * - 'json': standard clean JavaScript / JSON object
   * - 'mongo-shell': string representation with ObjectId(...), NumberInt(...), ISODate(...)
   * - 'mongo-extended': MongoDB Extended JSON v2 format
   * - 'all': returns all formats
   */
  format?: 'json' | 'mongo-shell' | 'mongo-extended' | 'all';

  /**
   * If true, throws an error when validation property checks fail.
   * If false (default), sanitizes/fixes fields where possible and returns warnings.
   */
  /**
   * Automatically detect and split multiple entities (e.g. multiple monsters) in the text
   */
  autoSplit?: boolean;

  /**
   * Break large entity text into semantic parts (header, traits, actions, legendary),
   * normalize each part individually, and stitch them back together.
   * Eliminates AI output token limits and hallucination for complex monsters/classes.
   */
  chunked?: boolean;

  /**
   * Skip cache retrieval and force fresh normalization
   */
  skipCache?: boolean;

  /**
   * Custom cache TTL in milliseconds for this request
   */
  cacheTtlMs?: number;

  /**
   * If true, throws an error when validation property checks fail.
   * If false (default), sanitizes/fixes fields where possible and returns warnings.
   */
  strict?: boolean;

  /**
   * Optional custom property check rules to execute
   */
  customChecks?: CustomCheckRule[];

  /**
   * If false (default), the cascade will never silently fall back to synthetic Mock data.
   * If all AI providers fail or are rate-limited, an error is returned.
   * Set to true to allow offline rule-based deterministic fallback.
   */
  allowMock?: boolean;

  /**
   * Minimum waiting period in milliseconds between consecutive calls to external AI providers.
   * Prevents API lockout. Defaults to 1500ms (or process.env.PROVIDER_MIN_INTERVAL_MS).
   */
  minIntervalMs?: number;

  /**
   * Default cooldown duration in seconds when an AI provider returns a rate-limit (429) without an explicit retry time.
   * Defaults to 60 seconds (or process.env.DEFAULT_COOLDOWN_SECONDS).
   */
  defaultCooldownSeconds?: number;

  /**
   * Cooldown duration in seconds when an AI provider exhausts its daily token / request quota.
   * If not set, automatically calculates seconds until next UTC midnight reset (between 4h and 24h).
   */
  dailyCooldownSeconds?: number;

  /**
   * Internal timeout in milliseconds for each external provider call before failing over.
   * Defaults to 12000ms.
   */
  providerTimeoutMs?: number;
}

export interface CustomCheckRule {
  name: string;
  field: string;
  validator: (value: any, obj: any) => boolean | string;
  fixer?: (value: any, obj: any) => any;
}

export interface CoercedField {
  path: string;
  original: any;
  coerced: any;
  reason: string;
}

export interface EntityRelation {
  field: string;
  targetCollection: string;
  value: string | string[];
}

export interface ValidationResult {
  isValid: boolean;
  checksRun: number;
  coercedFields: CoercedField[];
  warnings: string[];
  errors: string[];
}

export interface NormalizerProvider {
  name: string;
  isAvailable(): boolean;
  setAvailable?(state: boolean): void;
  normalize(text: string, schema: any, options: NormalizeOptions): Promise<string>;
}

export interface NormalizeResult<T = any> {
  success: boolean;
  data: T;
  mongoShell?: string;
  mongoExtended?: any;
  provider: string;
  latencyMs: number;
  validation: ValidationResult;
  relations?: EntityRelation[];
  cached?: boolean;
  chunked?: boolean;
  chunksProcessed?: string[];
  usedFallback?: boolean;
  isMock?: boolean;
  attemptedProviders?: string[];
}

export interface AutoSplitNormalizeResult {
  success: boolean;
  autoSplit: true;
  count: number;
  entities: any[];
  results: NormalizeResult[];
  mongoShell?: string;
  durationMs: number;
}

export interface BatchNormalizeResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  durationMs: number;
  results: Array<{
    index: number;
    success: boolean;
    result?: NormalizeResult;
    error?: string;
  }>;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  type?: 'cloud' | 'local' | 'mock';
  models?: string[];
  inCooldown?: boolean;
  cooldownRemainingSeconds?: number;
  cooldownReason?: string;
  cooldownUntil?: string;
  isValid?: boolean;
}
