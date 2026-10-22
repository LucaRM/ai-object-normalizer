import {
  NormalizerProvider,
  NormalizeOptions,
  NormalizeResult,
  NormalizerError,
  ErrorType,
  AutoSplitNormalizeResult,
  ProviderInfo
} from './types';
import { PropertyValidator } from './pipeline/validator';
import { ObjectFormatter } from './pipeline/formatter';
import { TextSplitter } from './pipeline/splitter';
import { NormalizationCache } from './pipeline/cache';
import { EntitySectioner } from './pipeline/sectioner';
import { EntityMerger } from './pipeline/merger';
import { FreeTranslator } from './pipeline/translator';
import { MonsterStatExtractor } from './pipeline/monsterExtractor';
import { MonsterActionParser } from './pipeline/actionParser';
import { getTemplate } from './templates';
import { IProviderStore, getProviderStore, RateLimitType, ProviderDocument } from './database';
import { CustomOpenAIProvider } from './providers/custom';

export class ObjectNormalizer {
  private providers: NormalizerProvider[];
  public cache = NormalizationCache.getInstance();
  private cooldowns: Map<string, { until: number; durationSeconds: number; reason: string }> = new Map();
  private lastCallTime: Map<string, number> = new Map();
  private store?: IProviderStore;

  constructor(providers: NormalizerProvider[] = [], store?: IProviderStore) {
    this.providers = providers;
    this.store = store;
  }

  /**
   * Assign persistent provider store (MongoDB or local JSON fallback)
   */
  public setStore(store: IProviderStore): void {
    this.store = store;
  }

  public getStore(): IProviderStore | undefined {
    return this.store;
  }

  /**
   * Helper to map provider display names to canonical database ID
   */
  public findProviderId(providerName: string): string {
    const lower = providerName.toLowerCase();
    if (lower.includes('cerebras')) return 'cerebras';
    if (lower.includes('sambanova')) return 'sambanova';
    if (lower.includes('mistral')) return 'mistral';
    if (lower.includes('deepseek')) return 'deepseek';
    if (lower.includes('github')) return 'github';
    if (lower.includes('huggingface') || lower.includes('hugging face')) return 'huggingface';
    if (lower.includes('gemini') || lower.includes('google')) return 'gemini';
    if (lower.includes('groq')) return 'groq';
    if (lower.includes('openrouter')) return 'openrouter';
    if (lower.includes('cohere')) return 'cohere';
    if (lower.includes('pollinations')) return 'pollinations';
    if (lower.includes('ovh') || lower.includes('kepler')) return 'ovh';
    if (lower.includes('openai') || lower.includes('chatgpt')) return 'openai';
    if (lower.includes('anthropic') || lower.includes('claude')) return 'anthropic';
    if (lower.includes('ollama')) return 'ollama';
    if (lower.includes('mock') || lower.includes('deterministic')) return 'mock';
    return lower.replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Sync active provider states, invalidations, and cooldown timestamps with the database.
   * If a cooldown was saved previously and hasn't expired yet, keeps waiting until that timestamp.
   */
  public async syncWithStore(store?: IProviderStore): Promise<void> {
    if (store) {
      this.store = store;
    }
    if (!this.store) {
      this.store = getProviderStore();
    }
    try {
      const docs = await this.store.getAll();
      const now = Date.now();
      for (const doc of docs) {
        let provider = this.providers.find(p => this.findProviderId(p.name) === doc.id);

        // Dynamically register custom provider if added through frontend / database
        if (!provider && (doc.apiKey || doc.baseUrl)) {
          const custom = new CustomOpenAIProvider(doc.id, doc.name, doc.apiKey, doc.model, doc.baseUrl);
          this.addProvider(custom);
          provider = custom;
          console.log(`[Normalizer] 🔌 Dynamically registered provider: "${doc.name}" (${doc.model || 'default'})`);
        }

        if (!provider) continue;

        // 0. If provider was manually disabled by user
        if (doc.manuallyDisabled === true || doc.isAvailable === false) {
          if (typeof provider.setAvailable === 'function') {
            provider.setAvailable(false);
          }
          continue;
        }

        // 1. If provider was marked invalid (e.g. revoked key or authentication failed)
        if (doc.isValid === false) {
          if (typeof provider.setAvailable === 'function') {
            provider.setAvailable(false);
          }
          console.warn(`[Normalizer] ⛔ Provider "${provider.name}" marked INVALID in database: ${doc.validationError || 'Invalid credentials'}`);
          continue;
        }

        // 2. If provider has an active persistent cooldown
        if (doc.cooldownUntil) {
          const untilMs = new Date(doc.cooldownUntil).getTime();
          if (untilMs > now) {
            const remainingSec = Math.ceil((untilMs - now) / 1000);
            this.cooldowns.set(provider.name, {
              until: untilMs,
              durationSeconds: remainingSec,
              reason: doc.cooldownReason || 'Persistent cooldown loaded from database'
            });
            if (typeof provider.setAvailable === 'function') {
              provider.setAvailable(false);
            }
            const durationHuman = remainingSec >= 86400
              ? `${(remainingSec / 86400).toFixed(1)}d`
              : (remainingSec >= 3600 ? `${(remainingSec / 3600).toFixed(1)}h` : `${remainingSec}s`);
            console.warn(`[Normalizer] ⏳ Loaded persistent cooldown for "${provider.name}": ${durationHuman} remaining (until ${doc.cooldownUntil}) [Reason: ${doc.cooldownReason || 'Quota limit'}]`);
          } else {
            // Cooldown has expired while server was offline -> clear it in store
            await this.store.clearCooldown(doc.id);
            if (typeof provider.setAvailable === 'function') {
              provider.setAvailable(true);
            }
          }
        } else {
          if (typeof provider.setAvailable === 'function') {
            provider.setAvailable(true);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Normalizer] Failed to sync with database store:', err.message);
    }
  }

  public setProviderAvailability(providerName: string, state: boolean): void {
    const provider = this.providers.find(p => p.name.toLowerCase() === providerName.toLowerCase() || this.findProviderId(p.name) === this.findProviderId(providerName));
    if (provider && typeof provider.setAvailable === 'function') {
      provider.setAvailable(state);
    }
  }

  public removeProvider(providerId: string): boolean {
    const id = this.findProviderId(providerId);
    const idx = this.providers.findIndex(p => this.findProviderId(p.name) === id);
    if (idx >= 0) {
      this.providers.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Helper to check if a provider is a local mock / deterministic extractor
   */
  public isMockProvider(provider: NormalizerProvider | string): boolean {
    const pName = (typeof provider === 'string' ? provider : provider.name).toLowerCase();
    return pName.includes('mock') || pName.includes('deterministic');
  }

  /**
   * Set a provider offline on cooldown for specified seconds and persist to database.
   * Clamped up to 45 days (3,888,000s) to handle monthly token limits.
   */
  public setProviderCooldown(
    providerName: string,
    seconds: number,
    reason: string = 'Rate limit / error',
    rateLimitType?: RateLimitType
  ): void {
    const clamped = Math.max(1, Math.min(seconds, 3888000));
    const until = Date.now() + (clamped * 1000);
    this.cooldowns.set(providerName, { until, durationSeconds: clamped, reason });
    const isMonthly = rateLimitType === 'month' || clamped >= 86400 * 3 || /month/i.test(reason);
    const isDaily = !isMonthly && (rateLimitType === 'day' || clamped >= 7200 || /day|daily|RPD|TPD/i.test(reason));
    const durationHuman = clamped >= 86400
      ? `${(clamped / 86400).toFixed(1)}d`
      : (clamped >= 3600
        ? `${(clamped / 3600).toFixed(1)}h`
        : (clamped >= 60 ? `${Math.ceil(clamped / 60)}m` : `${clamped}s`));
    const tag = isMonthly ? ' [MONTHLY QUOTA EXHAUSTED]' : (isDaily ? ' [DAILY QUOTA EXHAUSTED]' : '');
    console.warn(`[Normalizer] ⏳ Provider "${providerName}" set offline for ${durationHuman} (${clamped}s, until ${new Date(until).toISOString()})${tag}: ${reason}`);

    const provider = this.providers.find(p => p.name === providerName);
    if (provider && typeof provider.setAvailable === 'function') {
      provider.setAvailable(false);
    }

    if (this.store) {
      const providerId = this.findProviderId(providerName);
      const detectedType = rateLimitType || (isMonthly ? 'month' : (isDaily ? 'day' : 'minute'));
      this.store.setCooldown(providerId, new Date(until), reason, detectedType).catch((err: any) => {
        console.warn(`[Normalizer] Failed to persist cooldown for ${providerId}:`, err.message);
      });
    }
  }

  /**
   * Get remaining cooldown in seconds for a provider (0 if ready or expired)
   */
  public getCooldownRemaining(providerName: string): number {
    const cd = this.cooldowns.get(providerName);
    if (!cd) return 0;
    const remaining = Math.ceil((cd.until - Date.now()) / 1000);
    if (remaining <= 0) {
      this.clearCooldown(providerName);
      return 0;
    }
    return remaining;
  }

  /**
   * Clear cooldown for a provider and restore it to active rotation
   */
  public clearCooldown(providerName: string): void {
    if (this.cooldowns.has(providerName)) {
      this.cooldowns.delete(providerName);
      console.log(`[Normalizer] 🔄 Provider "${providerName}" cooldown expired! Restored to active rotation.`);
      const provider = this.providers.find(p => p.name === providerName);
      if (provider && typeof provider.setAvailable === 'function') {
        provider.setAvailable(true);
      }
    }
    if (this.store) {
      const providerId = this.findProviderId(providerName);
      this.store.clearCooldown(providerId).catch((err: any) => {
        console.warn(`[Normalizer] Failed to clear persistent cooldown for ${providerId}:`, err.message);
      });
    }
  }

  /**
   * Identifies the current highest-priority available provider for the given options
   */
  public getNextAvailableProvider(options: NormalizeOptions = {}): NormalizerProvider | undefined {
    if (options.specificProvider) {
      const target = options.specificProvider.toLowerCase().trim();
      return this.providers.find(p => {
        const pName = p.name.toLowerCase();
        return (
          pName === target ||
          pName.includes(target) ||
          target.includes(pName) ||
          (target === 'free' && (pName.includes('free') || pName.includes('pollinations') || pName.includes('ovh') || pName.includes('llama'))) ||
          (target === 'cohere' && pName.includes('cohere')) ||
          (target === 'mock' && this.isMockProvider(pName)) ||
          (target === 'deterministic' && this.isMockProvider(pName))
        );
      });
    }

    for (const provider of this.providers) {
      if (this.isMockProvider(provider) && !options.allowMock) {
        continue;
      }
      if (this.getCooldownRemaining(provider.name) > 0) {
        continue;
      }
      if (!provider.isAvailable()) {
        continue;
      }
      return provider;
    }
    return undefined;
  }

  /**
   * Determine the maximum single-shot text length threshold before chunking is recommended.
   * Tailored dynamically to each provider's context and output token window.
   */
  public getProviderChunkThreshold(provider?: NormalizerProvider): number {
    if (!provider) return 6000;
    const pName = provider.name.toLowerCase();

    // 1. Local Mock / Deterministic Heuristic Extractor:
    // Pure rule-based parser operates in a single pass in 0ms. Never chunk.
    if (this.isMockProvider(provider)) {
      return Infinity;
    }

    // 2. High capacity models: massive context (128k - 1M) & 8k+ output tokens
    // Gemini (1M), Groq (128k), OpenAI (128k), Anthropic, Cohere
    if (
      pName.includes('groq') ||
      pName.includes('gemini') ||
      pName.includes('openai') ||
      pName.includes('anthropic') ||
      pName.includes('cohere')
    ) {
      return 15000;
    }

    // 3. Medium tier (OpenRouter free models, local Ollama):
    if (pName.includes('openrouter') || pName.includes('ollama')) {
      return 8000;
    }

    // 4. Low tier / Keyless public proxies (Pollinations, OVH Kepler):
    // Strict output token caps (1500-2500 tokens). Chunk if text has extensive actions/traits (>2000 chars).
    if (pName.includes('pollinations') || pName.includes('ovh')) {
      return 2000;
    }

    return 6000;
  }

  /**
   * Smart decision: Should this entity be chunked based on text length AND the active provider?
   */
  public shouldChunkForProvider(text: string, provider?: NormalizerProvider, options: NormalizeOptions = {}): boolean {
    // Explicit user override always takes precedence
    if (options.chunked === true) return true;
    if (options.chunked === false) return false;

    const threshold = this.getProviderChunkThreshold(provider);
    return EntitySectioner.shouldSection(text, options.template, threshold);
  }

  /**
   * Check if a provider is currently unblocked and available
   */
  public isProviderAvailable(provider: NormalizerProvider): boolean {
    const remaining = this.getCooldownRemaining(provider.name);
    if (remaining > 0) {
      return false;
    }
    return provider.isAvailable();
  }

  /**
   * Parse cooldown period in seconds from error object, messages, or headers.
   * Handles explicit wait times (hours/mins/secs) from AIs, Retry-After headers,
   * and automatically applies a large daily cooldown (until UTC midnight reset)
   * when an AI indicates daily token or request quotas have been exhausted.
   */
  public parseCooldownSeconds(err: any, fallbackSeconds: number = 60, options: NormalizeOptions = {}): number {
    // Helper to extract case-insensitive headers
    const getHeader = (headers: any, name: string): any => {
      if (!headers || typeof headers !== 'object') return undefined;
      const lower = name.toLowerCase();
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === lower) return headers[k];
      }
      return undefined;
    };

    // Helper to parse duration string like '5h23m12s', '14h12m', '90s', etc.
    const parseDurationString = (str: string): number | null => {
      if (typeof str !== 'string' || !str.trim()) return null;
      const trimmed = str.trim();

      // 1. Hours, Minutes, Seconds: e.g. 5h23m12.345s or 5 hours, 23 minutes, and 12 seconds
      const hms = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+)\s*(?:h|hours?)\s*,?\s*(?:and\s*)?(\d+)\s*(?:m|min|mins|minutes?)\s*,?\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?/i);
      if (hms) {
        const h = Number(hms[1]) || 0;
        const m = Number(hms[2]) || 0;
        const s = Number(hms[3]) || 0;
        const total = h * 3600 + m * 60 + Math.ceil(s);
        if (total > 0) return total;
      }

      // 2. Hours and Minutes: e.g. 14h12m or 2 hours and 30 minutes
      const hm = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+)\s*(?:h|hours?)\s*,?\s*(?:and\s*)?(\d+)\s*(?:m|min|mins|minutes?)/i);
      if (hm) {
        const h = Number(hm[1]) || 0;
        const m = Number(hm[2]) || 0;
        const total = h * 3600 + m * 60;
        if (total > 0) return total;
      }

      // 3. Hours and Seconds: e.g. 1h 30s
      const hs = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+)\s*(?:h|hours?)\s*,?\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)/i);
      if (hs) {
        const h = Number(hs[1]) || 0;
        const s = Number(hs[2]) || 0;
        const total = h * 3600 + Math.ceil(s);
        if (total > 0) return total;
      }

      // 4. Hours only: e.g. in 4 hours, 1.5h
      const hOnly = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+(?:\.\d+)?)\s*(?:h|hours?)\b/i);
      if (hOnly) {
        const total = Math.ceil(parseFloat(hOnly[1]) * 3600);
        if (total > 0) return total;
      }

      // 5. Minutes and Seconds: e.g. 1m 30s, 2 minutes and 15 seconds
      const ms = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+)\s*(?:m|min|mins|minutes?)\s*,?\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)/i);
      if (ms) {
        const m = Number(ms[1]) || 0;
        const s = Number(ms[2]) || 0;
        const total = m * 60 + Math.ceil(s);
        if (total > 0) return total;
      }

      // 6. Minutes only: e.g. in 45 minutes, 2 mins
      const mOnly = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)\b/i);
      if (mOnly) {
        const total = Math.ceil(parseFloat(mOnly[1]) * 60);
        if (total > 0) return total;
      }

      // 7. Seconds only: e.g. in 23.456s, 45 seconds, 20s
      const sOnly = trimmed.match(/(?:in|after|wait|resets?|delay)?[:\s]*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\b/i);
      if (sOnly) {
        const total = Math.ceil(parseFloat(sOnly[1]));
        if (total > 0) return total;
      }

      // 8. Plain numeric value
      const num = Number(trimmed);
      if (!isNaN(num) && num > 0) {
        return Math.ceil(num);
      }

      return null;
    };

    // Helper: calculate seconds until the 1st of next month UTC (monthly reset time)
    const getSecondsUntilNextMonth = (): number => {
      const now = new Date();
      const nextMonth = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1,
        0, 2, 0 // 2 minutes past midnight UTC on the 1st
      ));
      const diffSec = Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
      return Math.max(86400, Math.min(3888000, diffSec));
    };

    // Helper: calculate seconds until next midnight UTC (daily reset time)
    const getSecondsUntilNextUtcMidnight = (): number => {
      const now = new Date();
      const nextMidnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 2, 0 // 2 minutes past midnight UTC
      ));
      const diffSec = Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000);
      return Math.max(14400, Math.min(86400, diffSec)); // Clamp between 4h and 24h
    };

    // 1. Explicit retryAfterSeconds property on error
    if (typeof err?.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0) {
      return Math.min(3888000, Math.max(1, Math.round(err.retryAfterSeconds)));
    }

    // 2. Check HTTP headers
    const headers = err?.rawError?.response?.headers || err?.response?.headers || err?.headers;
    if (headers) {
      // Retry-After-Ms
      const retryMs = getHeader(headers, 'retry-after-ms');
      if (retryMs) {
        const numMs = Number(retryMs);
        if (!isNaN(numMs) && numMs > 0) return Math.min(3888000, Math.max(1, Math.ceil(numMs / 1000)));
      }

      // Retry-After
      const retryHeader = getHeader(headers, 'retry-after');
      if (retryHeader) {
        const parsedDur = parseDurationString(String(retryHeader));
        if (parsedDur) return Math.min(3888000, Math.max(1, parsedDur));
        const dateHeader = new Date(retryHeader).getTime();
        if (!isNaN(dateHeader) && dateHeader > Date.now()) {
          const diffSec = Math.ceil((dateHeader - Date.now()) / 1000);
          return Math.min(3888000, Math.max(1, diffSec));
        }
      }

      // x-ratelimit-reset-requests or x-ratelimit-reset-tokens or x-ratelimit-reset
      const resetHeader = getHeader(headers, 'x-ratelimit-reset-requests') ||
                          getHeader(headers, 'x-ratelimit-reset-tokens') ||
                          getHeader(headers, 'x-ratelimit-reset') ||
                          getHeader(headers, 'anthropic-ratelimit-unified-reset');
      if (resetHeader) {
        const parsedDur = parseDurationString(String(resetHeader));
        if (parsedDur) {
          if (parsedDur > 1700000000) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (parsedDur > nowSec) return Math.min(3888000, Math.max(1, parsedDur - nowSec));
          } else {
            return Math.min(3888000, Math.max(1, parsedDur));
          }
        }
      }
    }

    // 3. Search text within error message, response body, and details
    const parts: string[] = [
      err?.message || '',
      err?.rawError?.message || '',
      typeof err?.rawError?.response?.data === 'string'
        ? err.rawError.response.data
        : JSON.stringify(err?.rawError?.response?.data || ''),
      typeof err?.response?.data === 'string'
        ? err.response.data
        : JSON.stringify(err?.response?.data || ''),
      typeof err?.details === 'string'
        ? err.details
        : JSON.stringify(err?.details || '')
    ];
    const combined = parts.join(' ');

    // 3a. Check for explicit duration in combined text
    const explicitDuration = parseDurationString(combined);

    // 4a. Check if error indicates MONTHLY quota / credits / token exhaustion
    const isMonthlyLimit =
      /monthly (?:quota|limit|usage|budget|credits?|token limit)/i.test(combined) ||
      /tokens? per month/i.test(combined) ||
      /requests? per month/i.test(combined) ||
      /per[- ]month/i.test(combined) ||
      /exceeded your monthly/i.test(combined) ||
      /exhausted your monthly/i.test(combined) ||
      /monthly tokens? exhausted/i.test(combined) ||
      /trial (?:balance|credits?|period) (?:expired|exhausted|depleted)/i.test(combined) ||
      /out of (?:monthly tokens|credits for the month)/i.test(combined);

    if (isMonthlyLimit) {
      if (explicitDuration && explicitDuration > 86400) {
        return Math.min(3888000, explicitDuration);
      }
      return getSecondsUntilNextMonth();
    }

    // 4b. Check if error indicates DAILY limit / tokens for the day
    const isDailyLimit =
      /requests per day/i.test(combined) ||
      /tokens per day/i.test(combined) ||
      /\bRPD\b/.test(combined) ||
      /\bTPD\b/.test(combined) ||
      /per[- ]day/i.test(combined) ||
      /daily (?:quota|limit|usage|rate limit|credits?|token limit)/i.test(combined) ||
      /ran out of tokens for the day/i.test(combined) ||
      /out of (?:tokens|credits) for (?:the day|today)/i.test(combined) ||
      /for the day/i.test(combined) ||
      /today's (?:quota|limit)/i.test(combined) ||
      /free tier daily/i.test(combined) ||
      /free daily limit/i.test(combined) ||
      /exceeded your daily/i.test(combined) ||
      /exhausted your daily/i.test(combined) ||
      /exhausted your (?:monthly\/)?daily credits/i.test(combined) ||
      /quota metric 'Generate Content API requests per day'/i.test(combined) ||
      /quota metric 'Tokens per day'/i.test(combined) ||
      /free tier limit exceeded for requests per day/i.test(combined) ||
      /limit 14400, used 14400/i.test(combined);

    if (isDailyLimit) {
      // If the provider explicitly stated how long until daily reset (e.g. Groq 'Please try again in 5h23m12s')
      if (explicitDuration && explicitDuration > 60) {
        return Math.min(86400, Math.max(1, explicitDuration));
      }
      // If no explicit time was stated, assign bigger timeframe (until UTC midnight or custom daily timeframe)
      const customDailySec = Number(process.env.DAILY_COOLDOWN_SECONDS || options.dailyCooldownSeconds);
      if (!isNaN(customDailySec) && customDailySec > 0) {
        return Math.min(86400, customDailySec);
      }
      return getSecondsUntilNextUtcMidnight();
    }

    // If explicit duration found for regular rate limit
    if (explicitDuration) {
      return Math.min(3888000, Math.max(1, explicitDuration));
    }

    // 5. Fallback defaults by error type
    const isRateLimit =
      err?.type === ErrorType.RATE_LIMIT ||
      err?.rawError?.response?.status === 429 ||
      err?.response?.status === 429 ||
      /rate limit|too many requests|429|quota/i.test(combined);

    if (isRateLimit) {
      return Math.min(3888000, Math.max(5, fallbackSeconds));
    }

    const isNetworkOrTimeout =
      err?.type === ErrorType.NETWORK_ERROR ||
      err?.code === 'ECONNABORTED' ||
      err?.code === 'ETIMEDOUT' ||
      /timeout|connection reset|econnreset|503|504/i.test(combined);

    if (isNetworkOrTimeout) {
      return 20;
    }

    return 30;
  }

  /**
   * Identifies the category of rate limit (month, day, minute) from error messages or headers
   */
  public detectRateLimitType(err: any): RateLimitType {
    const parts: string[] = [
      err?.message || '',
      err?.rawError?.message || '',
      typeof err?.rawError?.response?.data === 'string'
        ? err.rawError.response.data
        : JSON.stringify(err?.rawError?.response?.data || ''),
      typeof err?.response?.data === 'string'
        ? err.response.data
        : JSON.stringify(err?.response?.data || ''),
      typeof err?.details === 'string'
        ? err.details
        : JSON.stringify(err?.details || '')
    ];
    const combined = parts.join(' ');

    if (/monthly|per[- ]month|tokens? per month|requests? per month|monthly quota|monthly limit|monthly budget|free trial credits|trial balance/i.test(combined)) {
      return 'month';
    }
    if (/requests per day|tokens per day|\bRPD\b|\bTPD\b|per[- ]day|daily|for the day|today's quota|exhausted your daily/i.test(combined)) {
      return 'day';
    }
    return 'minute';
  }

  /**
   * Enforces call pacing delay between consecutive requests to external AI providers.
   * Prevents hitting burst rate limits and API lockouts.
   */
  public async enforceCallPacing(provider: NormalizerProvider, customIntervalMs?: number): Promise<void> {
    // Offline mock / deterministic extractor needs no network pacing
    if (this.isMockProvider(provider)) {
      return;
    }

    const minInterval = customIntervalMs !== undefined
      ? customIntervalMs
      : Number(process.env.PROVIDER_MIN_INTERVAL_MS ?? 1500);

    if (minInterval <= 0) {
      return;
    }

    const lastTime = this.lastCallTime.get(provider.name) || 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed < minInterval) {
      const waitMs = minInterval - elapsed;
      console.log(`[Normalizer] ⏱️ Call pacing for "${provider.name}": waiting ${waitMs}ms to prevent API lockout...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    this.lastCallTime.set(provider.name, Date.now());
  }

  /**
   * Ensures 2024 D&D monster fields like initiative, saving throws, and clean types
   * are extracted from the raw text even if an LLM omitted them or returned empty arrays.
   */
  public enrichMonster2024Attributes(entity: any, text: string): void {
    if (!entity || typeof entity !== 'object') return;

    // 1. Initiative: Extract "+16 (26)" or calculate from Dexterity
    if (!entity.initiative || typeof entity.initiative !== 'string' || entity.initiative.trim().length === 0) {
      entity.initiative = MonsterStatExtractor.extractInitiative(text, entity.abilities?.dexterity);
    }
    // Explicit initiative bonus: parse from entity.initiative or raw text
    entity.initiativeBonus = MonsterStatExtractor.extractInitiativeBonus(entity.initiative || text, entity.abilities?.dexterity);

    // 2. Hit Die formula: extract parenthetical formula (e.g. "29d10 + 174" from "HP 333 (29d10 + 174)")
    if (!entity.hitDie || typeof entity.hitDie !== 'string' || entity.hitDie.trim().length === 0) {
      const extractedHitDie = MonsterStatExtractor.extractHitDie(text);
      if (extractedHitDie) {
        entity.hitDie = extractedHitDie;
      }
    }

    // 3. Saving Throws: Filter out non-proficient saves (where Save == natural ability modifier)
    if (Array.isArray(entity.savingThrows) && entity.savingThrows.length > 0) {
      entity.savingThrows = MonsterStatExtractor.filterProficientSavingThrows(entity.savingThrows, entity.abilities);
    }
    // If savingThrows is empty (as 2024 blocks embed saves in ability table), extract from text
    if (!Array.isArray(entity.savingThrows) || entity.savingThrows.length === 0) {
      const extractedSaves = MonsterStatExtractor.extractSavingThrows(text);
      if (extractedSaves.length > 0) {
        entity.savingThrows = extractedSaves;
      }
    }

    // 4. Legendary Action Uses: Extract top-level count (e.g. 3 from "Legendary Action Uses: 3 (4 in Lair)")
    const legUses = MonsterStatExtractor.extractLegendaryActionUses(text);
    if (legUses !== undefined) {
      entity.legendaryActionUses = legUses;
    } else if (Array.isArray(entity.legendaryActions) && entity.legendaryActions.length > 0 && entity.legendaryActionUses === undefined) {
      entity.legendaryActionUses = 3;
    }

    // 5. Spellcasting Action
    if (Array.isArray(entity.actions)) {
      // Filter out dummy negative entries like "The assassin does not cast spells."
      entity.actions = entity.actions.filter((a: any) => {
        if (!a || typeof a !== 'object') return false;
        const name = (a.name || '').trim();
        const desc = (a.description || '').trim();
        if (/spellcasting/i.test(name) && /(?:does\s+not\s+(?:cast|have)|cannot\s+cast|no\s+spells|none\b|n\/a\b)/i.test(desc)) {
          return false;
        }
        return true;
      });
    } else {
      entity.actions = [];
    }

    const textHasSpellcasting = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Spellcasting\b/i.test(text);
    if (!textHasSpellcasting) {
      // If monster text does NOT mention Spellcasting, remove any hallucinated spellcasting action
      entity.actions = entity.actions.filter((a: any) => !/spellcasting/i.test(a?.name || ''));
    } else {
      // If monster text DOES mention Spellcasting, ensure it is present in actions
      const hasSpellcasting = entity.actions.some((a: any) => /spellcasting/i.test(a?.name || ''));
      if (!hasSpellcasting) {
        const extractedSpell = MonsterStatExtractor.extractSpellcastingAction(text);
        if (extractedSpell) {
          const parsedSpell = MonsterActionParser.parseAction(extractedSpell, 'actions');
          entity.actions.push(parsedSpell);
        }
      }
    }

    // 6. Clean type & size (eliminates "or Medium humanoid" -> "Humanoid")
    if (entity.type) {
      entity.type = MonsterStatExtractor.cleanType(entity.type);
    }
    if (entity.size) {
      entity.size = MonsterStatExtractor.cleanSize(entity.size);
    }

    // 7. Armor Class Type & Custom Type
    if (!entity.armorClassType) {
      const acType = MonsterStatExtractor.extractArmorClassType(text);
      if (acType) entity.armorClassType = acType;
    }
    if (!entity.customType) {
      const cType = MonsterStatExtractor.extractCustomType(text);
      if (cType) entity.customType = cType;
    }
  }

  /**
   * Add a provider to the normalizer cascade
   */
  addProvider(provider: NormalizerProvider): void {
    this.providers.push(provider);
  }

  /**
   * Normalize an unstructured text into a structured object matching a schema
   * using cascading AI providers, result caching, and semantic chunking for large entities.
   */
  async normalize<T = any>(
    text: string,
    schemaOrTemplate?: any,
    options: NormalizeOptions = {}
  ): Promise<NormalizeResult<T>> {
    const startTime = Date.now();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new NormalizerError('Text to normalize cannot be empty', ErrorType.PARSE_ERROR);
    }

    // Resolve target schema
    let targetSchema = schemaOrTemplate;
    if (options.template) {
      const tmpl = getTemplate(options.template);
      if (tmpl) {
        targetSchema = targetSchema || tmpl.schema;
      }
    } else if (typeof schemaOrTemplate === 'string') {
      const tmpl = getTemplate(schemaOrTemplate);
      if (tmpl) {
        options.template = schemaOrTemplate;
        targetSchema = tmpl.schema;
      }
    }

    if (!targetSchema || typeof targetSchema !== 'object') {
      throw new NormalizerError(
        'A target schema or template must be provided (either as an object or options.template)',
        ErrorType.VALIDATION_ERROR
      );
    }

    // 1. Check Result Cache (Deduplication)
    const cacheKey = NormalizationCache.generateHashKey(text, options.template, options);
    if (!options.skipCache) {
      const cached = this.cache.get<NormalizeResult<T>>(cacheKey);
      if (cached) {
        console.log(`[Normalizer] Cache hit for key: ${cacheKey.slice(0, 10)}... (0ms)`);
        return {
          ...cached,
          cached: true,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // 2. Smart provider-aware chunking decision
    const isMonster = (options.template || '').toLowerCase().trim() === 'monster';
    const activeProvider = this.getNextAvailableProvider(options);
    const shouldChunk = this.shouldChunkForProvider(text, activeProvider, options);

    if (shouldChunk && isMonster) {
      console.log(`[Normalizer] Entity length (${text.length} chars) exceeds threshold (${this.getProviderChunkThreshold(activeProvider)} chars) for "${activeProvider?.name || 'provider'}". Processing in semantic chunks...`);
      const chunkedResult = await this.normalizeChunkedMonster(text, targetSchema, options);
      if (!options.skipCache) {
        this.cache.set(cacheKey, chunkedResult, options.cacheTtlMs);
      }
      return chunkedResult as any;
    }

    // 3. Single Execution via Cascading Providers with Adaptive Self-Healing Chunking on Cutoff
    let execRes: {
      data: any;
      rawOutput: string;
      provider: string;
      usedFallback: boolean;
      attemptedProviders: string[];
    };
    try {
      execRes = await this.executeSingleNormalization(text, targetSchema, options);
    } catch (err: any) {
      // If single execution failed specifically due to token cutoff or truncated JSON and text has actions,
      // dynamically self-heal by switching to semantic chunking!
      const isTruncation =
        err.type === ErrorType.PARSE_ERROR ||
        /unexpected end of JSON|unterminated|token limit|max_tokens|cutoff/i.test(err.message || '');

      if (isMonster && isTruncation && options.chunked !== false) {
        console.warn(`[Normalizer] Single-shot output was truncated or invalid for "${activeProvider?.name || 'provider'}". Self-healing via multipart chunking...`);
        if (activeProvider) {
          this.clearCooldown(activeProvider.name);
        }
        const chunkedResult = await this.normalizeChunkedMonster(text, targetSchema, options);
        if (!options.skipCache) {
          this.cache.set(cacheKey, chunkedResult, options.cacheTtlMs);
        }
        return chunkedResult as any;
      }
      throw err;
    }

    if (isMonster) {
      this.enrichMonster2024Attributes(execRes.data, text);
    }

    // 4. Run property validation and normalization pipeline
    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      execRes.data,
      targetSchema,
      options
    );

    // Free keyless translation enrichment if locale is requested
    if (options.targetLocale) {
      await FreeTranslator.enrichTranslations(normalized, options.targetLocale);
    }

    const latencyMs = Date.now() - startTime;

    // 5. Multi-format serialization
    const format = options.format || 'all';
    let mongoShell: string | undefined;
    let mongoExtended: any | undefined;

    if (format === 'mongo-shell' || format === 'all') {
      mongoShell = ObjectFormatter.toMongoShell(normalized);
    }
    if (format === 'mongo-extended' || format === 'all') {
      mongoExtended = ObjectFormatter.toMongoExtended(normalized);
    }

    const isMock =
      execRes.provider.toLowerCase().includes('mock') ||
      execRes.provider.toLowerCase().includes('deterministic');

    const finalResult: NormalizeResult<T> = {
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      provider: execRes.provider,
      isMock,
      latencyMs,
      validation,
      relations,
      usedFallback: execRes.usedFallback,
      attemptedProviders: execRes.attemptedProviders.length > 1 ? execRes.attemptedProviders : undefined
    };

    // Store in cache
    if (!options.skipCache) {
      this.cache.set(cacheKey, finalResult, options.cacheTtlMs);
    }

    return finalResult;
  }

  /**
   * Executes a single prompt against cascading providers with automatic fallback
   */
  public async executeSingleNormalization(
    text: string,
    targetSchema: any,
    options: NormalizeOptions = {}
  ): Promise<{
    data: any;
    rawOutput: string;
    provider: string;
    usedFallback: boolean;
    attemptedProviders: string[];
  }> {
    const sanitizedText = TextSplitter.stripNoisyArtifacts(text);

    let rawOutput = '';
    let usedProvider = '';
    const attemptedProviders: string[] = [];
    const errorDetails: string[] = [];
    let usedFallback = false;

    // Specific provider requested
    if (options.specificProvider) {
      const target = options.specificProvider.toLowerCase().trim();
      const provider = this.providers.find(p => {
        const pName = p.name.toLowerCase();
        return (
          pName === target ||
          pName.includes(target) ||
          target.includes(pName) ||
          (target === 'free' && (pName.includes('free') || pName.includes('pollinations') || pName.includes('ovh') || pName.includes('llama'))) ||
          (target === 'pollinations' && pName.includes('pollinations')) ||
          (target === 'ovh' && pName.includes('ovh')) ||
          (target === 'llama' && pName.includes('llama')) ||
          (target === 'gemini' && pName.includes('gemini')) ||
          (target === 'claude' && pName.includes('anthropic')) ||
          (target === 'anthropic' && pName.includes('anthropic')) ||
          (target === 'openai' && pName.includes('openai')) ||
          (target === 'groq' && pName.includes('groq')) ||
          (target === 'ollama' && pName.includes('ollama')) ||
          (target === 'openrouter' && pName.includes('openrouter')) ||
          (target === 'mock' && this.isMockProvider(pName)) ||
          (target === 'deterministic' && this.isMockProvider(pName))
        );
      });

      if (!provider) {
        throw new NormalizerError(
          `Provider "${options.specificProvider}" not found. Available providers: ${this.providers
            .map(p => p.name)
            .join(', ')}`,
          ErrorType.API_ERROR
        );
      }

      const cdRemaining = this.getCooldownRemaining(provider.name);
      if (cdRemaining > 0) {
        const remHuman = cdRemaining >= 3600
          ? `${(cdRemaining / 3600).toFixed(1)}h`
          : `${cdRemaining}s`;
        throw new NormalizerError(
          `Provider "${provider.name}" is temporarily offline for ${remHuman} more (rate-limit cooldown). Try again later or use automatic cascade.`,
          ErrorType.RATE_LIMIT,
          provider.name,
          cdRemaining
        );
      }

      if (!provider.isAvailable()) {
        throw new NormalizerError(
          `Provider "${provider.name}" is currently unavailable or missing API key`,
          ErrorType.API_ERROR,
          provider.name
        );
      }

      try {
        await this.enforceCallPacing(provider, options.minIntervalMs);
        const providerTimeoutMs = options.providerTimeoutMs || 12000;
        let timer: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<string>((_, reject) => {
          timer = setTimeout(() => {
            reject(new NormalizerError(`Provider "${provider.name}" timed out after ${providerTimeoutMs / 1000}s`, ErrorType.NETWORK_ERROR, provider.name));
          }, providerTimeoutMs);
        });

        try {
          rawOutput = await Promise.race([
            provider.normalize(sanitizedText, targetSchema, { ...options, providerTimeoutMs }),
            timeoutPromise
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }

        this.lastCallTime.set(provider.name, Date.now());
        usedProvider = provider.name;
        const parsedData = PropertyValidator.extractJson(rawOutput);
        return {
          data: parsedData,
          rawOutput,
          provider: usedProvider,
          usedFallback: false,
          attemptedProviders: [provider.name]
        };
      } catch (err: any) {
        this.lastCallTime.set(provider.name, Date.now());
        const cooldownSec = this.parseCooldownSeconds(err, options.defaultCooldownSeconds || 60, options);
        const rateLimitType = this.detectRateLimitType(err);
        this.setProviderCooldown(provider.name, cooldownSec, err.message || 'Provider call failed', rateLimitType);

        if (this.store) {
          const providerId = this.findProviderId(provider.name);
          this.store.recordError(providerId, err.message || 'Provider call failed').catch(() => {});
        }

        // Check authentication or revoked key failure
        const isAuthError =
          err?.status === 401 ||
          err?.status === 403 ||
          err?.response?.status === 401 ||
          err?.response?.status === 403 ||
          err?.rawError?.response?.status === 401 ||
          err?.rawError?.response?.status === 403 ||
          /invalid (?:api[ _]?key|token|credential)|unauthorized|authentication failed|invalid authentication/i.test(err?.message || '');
        if (isAuthError && this.store) {
          const providerId = this.findProviderId(provider.name);
          this.store.setValidity(providerId, false, err.message || 'Authentication failed').catch(() => {});
          if (typeof provider.setAvailable === 'function') {
            provider.setAvailable(false);
          }
        }
        throw err;
      }
    } else {
      // Cascading priority fallback loop:
      // Always starts evaluating from provider index 0 (highest priority).
      // If provider 0 is in cooldown, falls back to provider 1.
      // As soon as provider 0's cooldown expires, future calls automatically return to provider 0!
      if (this.providers.length === 0) {
        throw new NormalizerError('No providers configured for normalizer', ErrorType.UNKNOWN);
      }

      for (let i = 0; i < this.providers.length; i++) {
        const provider = this.providers[i];

        // Guard: Mock/Deterministic provider is used unless explicitly disabled (allowMock === false)
        if (this.isMockProvider(provider) && options.allowMock === false) {
          continue;
        }

        // 1. Check cooldown
        const remainingCooldown = this.getCooldownRemaining(provider.name);
        if (remainingCooldown > 0) {
          const remHuman = remainingCooldown >= 3600
            ? `${(remainingCooldown / 3600).toFixed(1)}h`
            : `${remainingCooldown}s`;
          errorDetails.push(`${provider.name}: offline in cooldown (${remHuman} remaining)`);
          continue;
        }

        // 2. Check general availability
        if (!provider.isAvailable()) {
          errorDetails.push(`${provider.name}: unavailable`);
          continue;
        }

        attemptedProviders.push(provider.name);

        try {
          // Enforce pacing interval before calling external provider
          await this.enforceCallPacing(provider, options.minIntervalMs);

          const providerTimeoutMs = options.providerTimeoutMs || 12000;
          let timer: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise<string>((_, reject) => {
            timer = setTimeout(() => {
              reject(new NormalizerError(`Provider "${provider.name}" timed out after ${providerTimeoutMs / 1000}s`, ErrorType.NETWORK_ERROR, provider.name));
            }, providerTimeoutMs);
          });

          try {
            rawOutput = await Promise.race([
              provider.normalize(sanitizedText, targetSchema, { ...options, providerTimeoutMs }),
              timeoutPromise
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }

          this.lastCallTime.set(provider.name, Date.now());

          const parsedData = PropertyValidator.extractJson(rawOutput);
          usedProvider = provider.name;
          if (attemptedProviders.length > 1 || i > 0) {
            usedFallback = true;
          }
          return {
            data: parsedData,
            rawOutput,
            provider: usedProvider,
            usedFallback,
            attemptedProviders
          };
        } catch (err: any) {
          this.lastCallTime.set(provider.name, Date.now());
          const errMsg = err.message || 'Unknown provider error';
          console.warn(`[Normalizer] Provider "${provider.name}" failed: ${errMsg}`);
          errorDetails.push(`${provider.name}: ${errMsg}`);

          // Record error in store
          if (this.store) {
            const providerId = this.findProviderId(provider.name);
            this.store.recordError(providerId, errMsg).catch(() => {});
          }

          // Check authentication or revoked key failure
          const isAuthError =
            err?.status === 401 ||
            err?.status === 403 ||
            err?.response?.status === 401 ||
            err?.response?.status === 403 ||
            err?.rawError?.response?.status === 401 ||
            err?.rawError?.response?.status === 403 ||
            /invalid (?:api[ _]?key|token|credential)|unauthorized|authentication failed|invalid authentication/i.test(errMsg);
          if (isAuthError) {
            const providerId = this.findProviderId(provider.name);
            if (this.store) {
              this.store.setValidity(providerId, false, errMsg).catch(() => {});
            }
            if (typeof provider.setAvailable === 'function') {
              provider.setAvailable(false);
            }
          }

          // Set provider offline for parsed cooldown duration only if network/rate-limit error, not format/truncation error
          const isParseOrTruncation = err.type === ErrorType.PARSE_ERROR || /JSON|parse|unterminated|truncat|max_tokens/i.test(errMsg);
          if (!isParseOrTruncation) {
            const cooldownSec = this.parseCooldownSeconds(err, options.defaultCooldownSeconds || 60, options);
            const rateLimitType = this.detectRateLimitType(err);
            this.setProviderCooldown(provider.name, cooldownSec, errMsg, rateLimitType);
          }

          // Proceed to next priority provider
        }
      }

      throw new NormalizerError(
        `All AI providers failed in cascading fallback. Attempted: [${attemptedProviders.join(
          ', '
        )}]. Details: ${errorDetails.join(' | ')}`,
        ErrorType.API_ERROR
      );
    }
  }

  /**
   * Normalizes a complex monster in semantic parts (header, traits, actions, legendary),
   * saving interim responses and stitching them back into a complete monster document.
   */
  async normalizeChunkedMonster(
    text: string,
    schemaOrTemplate?: any,
    options: NormalizeOptions = {}
  ): Promise<NormalizeResult> {
    const startTime = Date.now();
    const sections = EntitySectioner.splitMonster(text);

    // If only header was found, execute as standard single normalization
    if (!sections.traits && !sections.actions && !sections.legendary) {
      return this.executeSingleNormalization(text, schemaOrTemplate, options)
        .then(res => {
          const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
            res.data,
            schemaOrTemplate,
            options
          );
          return {
            success: true,
            data: normalized,
            provider: res.provider,
            latencyMs: Date.now() - startTime,
            validation,
            relations
          };
        });
    }

    const tmpl = getTemplate('monster');
    const fullSchema = schemaOrTemplate || tmpl?.schema;

    const chunksProcessed: string[] = [];
    const partialResults: Record<string, any> = {};

    // 1. Core Header (Stats, AC, HP, Abilities, Senses, Languages, CR)
    console.log(`  [Chunk 1/4] Normalizing Core Header & Stats (${sections.header.length} chars)...`);
    const headerSchema = {
      name: fullSchema?.name || 'Monster',
      type: fullSchema?.type || 'Beast',
      size: fullSchema?.size || 'Medium',
      alignment: fullSchema?.alignment || 'Unaligned',
      armorClass: fullSchema?.armorClass || 10,
      initiative: fullSchema?.initiative || '+0 (10)',
      hitPoints: fullSchema?.hitPoints || 10,
      speed: fullSchema?.speed || '30 ft.',
      abilities: fullSchema?.abilities || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      skills: fullSchema?.skills || [],
      savingThrows: fullSchema?.savingThrows || [],
      senses: fullSchema?.senses || '',
      languages: fullSchema?.languages || '',
      challengeRating: fullSchema?.challengeRating || '1',
      proficiencyBonus: fullSchema?.proficiencyBonus || 2,
      damageResistances: fullSchema?.damageResistances || '',
      damageImmunities: fullSchema?.damageImmunities || '',
      conditionImmunities: fullSchema?.conditionImmunities || '',
      books: fullSchema?.books || ['Monster Manual 2024']
    };

    const headerRes = await this.executeSingleNormalization(sections.header, headerSchema, {
      ...options,
      skipCache: true
    });
    partialResults.header = headerRes.data;
    chunksProcessed.push('header');

    // 2. Traits (if present)
    if (sections.traits) {
      console.log(`  [Chunk 2/4] Normalizing Special Traits (${sections.traits.length} chars)...`);
      const traitsSchema = {
        traits: [
          { name: 'Trait Name', description: 'Trait rules text...' }
        ]
      };
      const traitsRes = await this.executeSingleNormalization(sections.traits, traitsSchema, {
        ...options,
        skipCache: true
      });
      partialResults.traits = traitsRes.data;
      chunksProcessed.push('traits');
    }

    // 3. Actions (if present)
    if (sections.actions) {
      console.log(`  [Chunk 3/4] Normalizing Combat Actions (${sections.actions.length} chars)...`);
      const actionsSchema = {
        actions: [
          { name: 'Action Name', description: 'Attack Roll or action description...' }
        ],
        reactions: [
          { name: 'Reaction Name', description: 'Reaction trigger and description...' }
        ]
      };
      const actionsRes = await this.executeSingleNormalization(sections.actions, actionsSchema, {
        ...options,
        skipCache: true
      });
      partialResults.actions = actionsRes.data;
      chunksProcessed.push('actions');
    }

    // 3.25 Bonus Actions (if present)
    if (sections.bonusActions) {
      console.log(`  [Chunk Bonus Actions] Normalizing Bonus Actions (${sections.bonusActions.length} chars)...`);
      const bonusSchema = {
        bonusActions: [
          { name: 'Bonus Action Name', description: 'Bonus action effect and description...' }
        ]
      };
      const bonusRes = await this.executeSingleNormalization(sections.bonusActions, bonusSchema, {
        ...options,
        skipCache: true
      });
      partialResults.bonusActions = bonusRes.data;
      chunksProcessed.push('bonusActions');
    }

    // 3.5 Standalone Reactions section (if present)
    if (sections.reactions) {
      console.log(`  [Chunk Reactions] Normalizing Combat Reactions (${sections.reactions.length} chars)...`);
      const reactionsSchema = {
        reactions: [
          { name: 'Reaction Name', description: 'Reaction trigger and description...' }
        ]
      };
      const reactionsRes = await this.executeSingleNormalization(sections.reactions, reactionsSchema, {
        ...options,
        skipCache: true
      });
      partialResults.reactions = reactionsRes.data;
      chunksProcessed.push('reactions');
    }

    // 4. Legendary Actions (if present)
    if (sections.legendary) {
      console.log(`  [Chunk 4/4] Normalizing Legendary Actions (${sections.legendary.length} chars)...`);
      const legSchema = {
        legendaryActionUses: 3,
        legendaryActions: [
          { name: 'Option Name', description: 'Legendary action cost and description...' }
        ]
      };
      const legRes = await this.executeSingleNormalization(sections.legendary, legSchema, {
        ...options,
        skipCache: true
      });
      partialResults.legendary = legRes.data;
      chunksProcessed.push('legendary');
    }

    // 5. Stitch all parts together
    console.log(`  → Merging ${chunksProcessed.length} normalized chunks into unified entity...`);
    const mergedData = EntityMerger.mergeMonster(partialResults as any);

    // Enrich 2024 attributes (Initiative, 2024 embedded saving throws, clean type) from raw text
    this.enrichMonster2024Attributes(mergedData, text);

    // 6. Run full property validation & formatting on unified document
    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      mergedData,
      fullSchema,
      options
    );

    // Free keyless translation enrichment if locale is requested
    if (options.targetLocale) {
      await FreeTranslator.enrichTranslations(normalized, options.targetLocale);
    }

    const latencyMs = Date.now() - startTime;
    const format = options.format || 'all';
    let mongoShell: string | undefined;
    let mongoExtended: any | undefined;

    if (format === 'mongo-shell' || format === 'all') {
      mongoShell = ObjectFormatter.toMongoShell(normalized);
    }
    if (format === 'mongo-extended' || format === 'all') {
      mongoExtended = ObjectFormatter.toMongoExtended(normalized);
    }

    const isMock =
      headerRes.provider.toLowerCase().includes('mock') ||
      headerRes.provider.toLowerCase().includes('deterministic');

    return {
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      provider: headerRes.provider,
      isMock,
      latencyMs,
      validation,
      relations,
      chunked: true,
      chunksProcessed
    };
  }

  /**
   * Normalizes an individual part within a multipart session
   */
  async normalizeSessionPart(sessionId: string, section: string, text: string): Promise<any> {
    const session = this.cache.getSession(sessionId);
    if (!session) {
      throw new NormalizerError(`Session "${sessionId}" not found or expired`, ErrorType.VALIDATION_ERROR);
    }

    let subSchema: any;
    if (section === 'header') {
      const tmpl = getTemplate(session.template || 'monster');
      subSchema = tmpl ? { ...tmpl.schema } : { name: 'Monster' };
      delete subSchema.traits;
      delete subSchema.actions;
      delete subSchema.reactions;
      delete subSchema.legendaryActions;
    } else if (section === 'traits') {
      subSchema = { traits: [{ name: 'string', description: 'string' }] };
    } else if (section === 'actions') {
      subSchema = {
        actions: [{ name: 'string', description: 'string' }],
        reactions: [{ name: 'string', description: 'string' }]
      };
    } else if (section === 'legendary') {
      subSchema = { legendaryActions: [{ name: 'string', description: 'string' }] };
    } else {
      subSchema = { [section]: [] };
    }

    const execRes = await this.executeSingleNormalization(text, subSchema, session.options);
    this.cache.saveSessionPart(sessionId, section, execRes.data, text);

    return {
      success: true,
      sessionId,
      section,
      provider: execRes.provider,
      partsCompleted: Object.keys(session.parts)
    };
  }

  /**
   * Completes a multipart session by stitching all cached parts together
   */
  async completeMultipartSession(sessionId: string, options: NormalizeOptions = {}): Promise<NormalizeResult> {
    const session = this.cache.getSession(sessionId);
    if (!session) {
      throw new NormalizerError(`Session "${sessionId}" not found or expired`, ErrorType.VALIDATION_ERROR);
    }

    const tmpl = getTemplate(session.template || 'monster');
    const fullSchema = tmpl?.schema;

    const mergedData = EntityMerger.mergeMonster(session.parts as any);
    const mergedOptions: NormalizeOptions = { ...session.options, ...options };

    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      mergedData,
      fullSchema,
      mergedOptions
    );

    const format = mergedOptions.format || 'all';
    let mongoShell: string | undefined;
    let mongoExtended: any | undefined;

    if (format === 'mongo-shell' || format === 'all') {
      mongoShell = ObjectFormatter.toMongoShell(normalized);
    }
    if (format === 'mongo-extended' || format === 'all') {
      mongoExtended = ObjectFormatter.toMongoExtended(normalized);
    }

    // Clean up session
    this.cache.clearSession(sessionId);

    return {
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      provider: 'Multi-part Cascade',
      latencyMs: Date.now() - session.createdAt,
      validation,
      relations,
      chunked: true,
      chunksProcessed: Object.keys(session.parts)
    };
  }

  /**
   * Automatically detects and normalizes multiple entities within a single text block
   */
  async normalizeAutoSplit(
    text: string,
    schemaOrTemplate?: any,
    options: NormalizeOptions = {}
  ): Promise<AutoSplitNormalizeResult> {
    const startTime = Date.now();
    const sections = TextSplitter.splitMonsters(text);

    if (sections.length <= 1) {
      const single = await this.normalize(text, schemaOrTemplate, options);
      return {
        success: single.success,
        autoSplit: true,
        count: 1,
        entities: [single.data],
        results: [single],
        mongoShell: single.mongoShell,
        durationMs: Date.now() - startTime
      };
    }

    console.log(`[Normalizer] Auto-detected ${sections.length} distinct entities in text.`);
    const results: NormalizeResult[] = [];
    const entities: any[] = [];
    const shellScripts: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`  → Normalizing [${i + 1}/${sections.length}]: ${section.name}...`);
      const res = await this.normalize(section.text, schemaOrTemplate, options);
      results.push(res);
      entities.push(res.data);
      if (res.mongoShell) {
        shellScripts.push(`// ==========================================\n// Entity ${i + 1}: ${section.name}\n// ==========================================\n${res.mongoShell}`);
      }
    }

    return {
      success: true,
      autoSplit: true,
      count: sections.length,
      entities,
      results,
      mongoShell: shellScripts.join('\n\n'),
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Reset providers and clear all active cooldowns
   */
  resetProviders(): void {
    this.cooldowns.clear();
    for (const provider of this.providers) {
      if (typeof provider.setAvailable === 'function') {
        provider.setAvailable(true);
      }
    }
    console.log('[Normalizer] All provider cooldowns cleared and availability reset.');
  }

  /**
   * Get list of currently available providers that are not in cooldown
   */
  getAvailableProviders(): string[] {
    return this.providers
      .filter(p => this.isProviderAvailable(p))
      .map(p => p.name);
  }

  /**
   * Get all provider names with detailed cooldown and availability status
   */
  getAllProvidersInfo(): ProviderInfo[] {
    return this.providers.map(p => {
      const remaining = this.getCooldownRemaining(p.name);
      const inCooldown = remaining > 0;
      const cd = this.cooldowns.get(p.name);

      return {
        name: p.name,
        available: !inCooldown && p.isAvailable(),
        inCooldown,
        cooldownRemainingSeconds: inCooldown ? remaining : 0,
        cooldownReason: inCooldown ? cd?.reason : undefined,
        cooldownUntil: inCooldown && cd ? new Date(cd.until).toISOString() : undefined,
        isValid: typeof p.isAvailable === 'function' ? p.isAvailable() : true,
        type: this.isMockProvider(p)
          ? 'mock'
          : p.name.toLowerCase().includes('ollama')
          ? 'local'
          : 'cloud'
      };
    });
  }
}
