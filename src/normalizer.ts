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
import { getTemplate } from './templates';

export class ObjectNormalizer {
  private providers: NormalizerProvider[];
  public cache = NormalizationCache.getInstance();
  private cooldowns: Map<string, { until: number; durationSeconds: number; reason: string }> = new Map();
  private lastCallTime: Map<string, number> = new Map();

  constructor(providers: NormalizerProvider[] = []) {
    this.providers = providers;
  }

  /**
   * Helper to check if a provider is a local mock / deterministic extractor
   */
  public isMockProvider(provider: NormalizerProvider | string): boolean {
    const pName = (typeof provider === 'string' ? provider : provider.name).toLowerCase();
    return pName.includes('mock') || pName.includes('deterministic');
  }

  /**
   * Set a provider offline on cooldown for specified seconds
   */
  public setProviderCooldown(providerName: string, seconds: number, reason: string = 'Rate limit / error'): void {
    const clamped = Math.max(1, Math.min(seconds, 86400));
    const until = Date.now() + (clamped * 1000);
    this.cooldowns.set(providerName, { until, durationSeconds: clamped, reason });
    console.warn(`[Normalizer] ⏳ Provider "${providerName}" set offline for ${clamped}s (until ${new Date(until).toLocaleTimeString()}): ${reason}`);

    const provider = this.providers.find(p => p.name === providerName);
    if (provider && typeof provider.setAvailable === 'function') {
      provider.setAvailable(false);
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
   * Parse cooldown period in seconds from error object, messages, or headers
   */
  public parseCooldownSeconds(err: any, fallbackSeconds: number = 60): number {
    // 1. Explicit retryAfterSeconds property
    if (typeof err?.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0) {
      return Math.min(3600, Math.max(1, Math.round(err.retryAfterSeconds)));
    }

    // 2. HTTP Retry-After header
    const headers = err?.rawError?.response?.headers || err?.response?.headers;
    const retryHeader = headers?.['retry-after'];
    if (retryHeader) {
      const numHeader = Number(retryHeader);
      if (!isNaN(numHeader) && numHeader > 0) {
        return Math.min(3600, Math.max(1, Math.round(numHeader)));
      }
      const dateHeader = new Date(retryHeader).getTime();
      if (!isNaN(dateHeader) && dateHeader > Date.now()) {
        const diffSec = Math.ceil((dateHeader - Date.now()) / 1000);
        return Math.min(3600, Math.max(1, diffSec));
      }
    }

    // 3. Search text within error message and response body
    const parts: string[] = [
      err?.message || '',
      err?.rawError?.message || '',
      typeof err?.rawError?.response?.data === 'string'
        ? err.rawError.response.data
        : JSON.stringify(err?.rawError?.response?.data || ''),
      typeof err?.response?.data === 'string'
        ? err.response.data
        : JSON.stringify(err?.response?.data || '')
    ];
    const combined = parts.join(' ');

    // 3a. Minutes + Seconds pattern (e.g. "try again in 1m 20s" or "resets in 2 minutes and 30 seconds")
    const minSecMatch = combined.match(/(?:try again|retry|wait|resets?|cooling down|rate limit)(?:\s+(?:in|after))?\s*[:]?\s*(\d+)\s*(?:m|min|mins|minutes?)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)/i);
    if (minSecMatch) {
      const mins = Number(minSecMatch[1]);
      const secs = Number(minSecMatch[2]);
      return Math.min(3600, Math.max(1, Math.ceil(mins * 60 + secs)));
    }

    // 3b. Minutes only pattern (e.g. "try again in 2 minutes", "resets in 1.5 mins")
    const minMatch = combined.match(/(?:try again|retry|wait|resets?|cooling down|rate limit)(?:\s+(?:in|after))?\s*[:]?\s*(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)\b/i);
    if (minMatch) {
      const mins = parseFloat(minMatch[1]);
      if (!isNaN(mins) && mins > 0) {
        return Math.min(3600, Math.max(1, Math.ceil(mins * 60)));
      }
    }

    // 3c. Seconds pattern (e.g. "try again in 15.2s", "retry after 30 seconds", "resets in 45s", "wait: 20s")
    const secMatch = combined.match(/(?:try again|retry|wait|resets?|cooling down|rate limit)(?:\s+(?:in|after))?\s*[:]?\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\b/i);
    if (secMatch) {
      const secs = parseFloat(secMatch[1]);
      if (!isNaN(secs) && secs > 0) {
        return Math.min(3600, Math.max(1, Math.ceil(secs)));
      }
    }

    // 3d. Fallback generic "in X seconds" / "after X seconds"
    const genericSecMatch = combined.match(/(?:in|after)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\b/i);
    if (genericSecMatch) {
      const secs = parseFloat(genericSecMatch[1]);
      if (!isNaN(secs) && secs > 0) {
        return Math.min(3600, Math.max(1, Math.ceil(secs)));
      }
    }

    // 4. Fallback defaults by error type
    const isRateLimit =
      err?.type === ErrorType.RATE_LIMIT ||
      err?.rawError?.response?.status === 429 ||
      err?.response?.status === 429 ||
      /rate limit|too many requests|429|quota/i.test(combined);

    if (isRateLimit) {
      return Math.min(3600, Math.max(5, fallbackSeconds));
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

    // 2. Saving Throws: If LLM returned empty [] (as 2024 blocks embed saves in ability table), extract from text
    if (!Array.isArray(entity.savingThrows) || entity.savingThrows.length === 0) {
      const extractedSaves = MonsterStatExtractor.extractSavingThrows(text);
      if (extractedSaves.length > 0) {
        entity.savingThrows = extractedSaves;
      }
    }

    // 3. Clean type & size (eliminates "or Medium humanoid" -> "Humanoid")
    if (entity.type) {
      entity.type = MonsterStatExtractor.cleanType(entity.type);
    }
    if (entity.size) {
      entity.size = MonsterStatExtractor.cleanSize(entity.size);
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

    // 2. Check if Chunked Multipart Processing is needed for complex monsters
    const isMonster = (options.template || '').toLowerCase().trim() === 'monster';
    if ((options.chunked || (options.chunked === undefined && EntitySectioner.shouldSection(text, options.template))) && isMonster) {
      console.log(`[Normalizer] Breaking complex monster into semantic parts to prevent token limit cutoff...`);
      const chunkedResult = await this.normalizeChunkedMonster(text, targetSchema, options);
      if (!options.skipCache) {
        this.cache.set(cacheKey, chunkedResult, options.cacheTtlMs);
      }
      return chunkedResult as any;
    }

    // 3. Single Execution via Cascading Providers
    const execRes = await this.executeSingleNormalization(text, targetSchema, options);

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
        throw new NormalizerError(
          `Provider "${provider.name}" is temporarily offline for ${cdRemaining} more seconds (rate-limit cooldown). Try again later or use automatic cascade.`,
          ErrorType.RATE_LIMIT,
          provider.name
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
        rawOutput = await provider.normalize(sanitizedText, targetSchema, options);
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
        const cooldownSec = this.parseCooldownSeconds(err, options.defaultCooldownSeconds || 60);
        this.setProviderCooldown(provider.name, cooldownSec, err.message || 'Provider call failed');
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

        // Guard: Mock/Deterministic provider is only used in cascade if options.allowMock === true
        if (this.isMockProvider(provider) && !options.allowMock) {
          continue;
        }

        // 1. Check cooldown
        const remainingCooldown = this.getCooldownRemaining(provider.name);
        if (remainingCooldown > 0) {
          errorDetails.push(`${provider.name}: offline in cooldown (${remainingCooldown}s remaining)`);
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

          rawOutput = await provider.normalize(sanitizedText, targetSchema, options);
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

          // Set provider offline for parsed cooldown duration
          const cooldownSec = this.parseCooldownSeconds(err, options.defaultCooldownSeconds || 60);
          this.setProviderCooldown(provider.name, cooldownSec, errMsg);

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
        type: this.isMockProvider(p)
          ? 'mock'
          : p.name.toLowerCase().includes('ollama')
          ? 'local'
          : 'cloud'
      };
    });
  }
}
