export type RateLimitType = 'minute' | 'day' | 'month' | 'manual';

export interface ProviderDocument {
  /**
   * Unique provider identifier (lowercase, e.g. 'groq', 'gemini', 'github', 'sambanova', 'cerebras')
   */
  id: string;

  /**
   * Display name (e.g. 'Groq', 'Gemini', 'GitHub Models')
   */
  name: string;

  /**
   * Provider architecture type
   */
  providerType: string;

  /**
   * API Key or token (optional)
   */
  apiKey?: string;

  /**
   * Optional custom Base URL for OpenAI-compatible endpoints
   */
  baseUrl?: string;

  /**
   * Selected model name (e.g. 'llama-3.3-70b', 'gpt-4o-mini')
   */
  model?: string;

  /**
   * Whether the provider credentials are valid (false if 401/403 or revoked)
   */
  isValid: boolean;

  /**
   * Error message if marked invalid
   */
  validationError?: string;

  /**
   * Whether the provider was explicitly turned off manually by the user
   */
  manuallyDisabled?: boolean;

  /**
   * Most recent error message encountered
   */
  lastErrorMessage?: string;

  /**
   * Timestamp of the most recent error
   */
  lastErrorAt?: string | null;

  /**
   * Whether the provider is enabled in rotation
   */
  isAvailable: boolean;

  /**
   * Persistent ISO 8601 timestamp until which the provider must stay in cooldown.
   * Survives API and server restarts.
   */
  cooldownUntil?: string | null;

  /**
   * Total cooldown duration originally assigned (seconds)
   */
  cooldownDurationSeconds?: number;

  /**
   * Reason for cooldown (e.g. 'Monthly token quota exhausted', 'Daily RPD limit reached')
   */
  cooldownReason?: string;

  /**
   * Category of rate limit (minute, day, month, manual)
   */
  rateLimitType?: RateLimitType | null;

  /**
   * Monthly quota allocation (if known)
   */
  monthlyQuota?: number;

  /**
   * Monthly quota usage count (if known)
   */
  monthlyUsed?: number;

  /**
   * ISO timestamp of the last time this provider was called
   */
  lastUsedAt?: string | null;

  /**
   * ISO timestamp of the last time this provider was health-checked
   */
  lastCheckedAt?: string | null;

  /**
   * Creation timestamp
   */
  createdAt: string;

  /**
   * Last updated timestamp
   */
  updatedAt: string;

  /**
   * Additional provider metadata
   */
  metadata?: Record<string, any>;
}

export interface DatabaseStatus {
  enabled: boolean;
  engine: 'mongodb' | 'file' | 'disabled';
  connected: boolean;
  uri?: string;
  filePath?: string;
  providerCount: number;
  availableCount: number;
  inCooldownCount: number;
  invalidCount: number;
}
