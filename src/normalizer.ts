import {
  NormalizerProvider,
  NormalizeOptions,
  NormalizeResult,
  NormalizerError,
  ErrorType,
  AutoSplitNormalizeResult
} from './types';
import { PropertyValidator } from './pipeline/validator';
import { ObjectFormatter } from './pipeline/formatter';
import { TextSplitter } from './pipeline/splitter';
import { NormalizationCache } from './pipeline/cache';
import { EntitySectioner } from './pipeline/sectioner';
import { EntityMerger } from './pipeline/merger';
import { getTemplate } from './templates';

export class ObjectNormalizer {
  private providers: NormalizerProvider[];
  private currentProviderIndex = 0;
  public cache = NormalizationCache.getInstance();

  constructor(providers: NormalizerProvider[] = []) {
    this.providers = providers;
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

    // 4. Run property validation and normalization pipeline
    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      execRes.data,
      targetSchema,
      options
    );

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

    const finalResult: NormalizeResult<T> = {
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      provider: execRes.provider,
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
          (target === 'pollinations' && pName.includes('pollinations')) ||
          (target === 'gemini' && pName.includes('gemini')) ||
          (target === 'claude' && pName.includes('anthropic')) ||
          (target === 'anthropic' && pName.includes('anthropic')) ||
          (target === 'openai' && pName.includes('openai')) ||
          (target === 'groq' && pName.includes('groq')) ||
          (target === 'ollama' && pName.includes('ollama')) ||
          (target === 'openrouter' && pName.includes('openrouter')) ||
          (target === 'mock' && pName.includes('mock'))
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

      if (!provider.isAvailable()) {
        throw new NormalizerError(
          `Provider "${options.specificProvider}" is currently unavailable or missing API key`,
          ErrorType.API_ERROR,
          provider.name
        );
      }

      rawOutput = await provider.normalize(sanitizedText, targetSchema, options);
      usedProvider = provider.name;
    } else {
      // Cascading fallback loop
      if (this.providers.length === 0) {
        throw new NormalizerError('No providers configured for normalizer', ErrorType.UNKNOWN);
      }

      let succeeded = false;

      for (let attempt = 0; attempt < this.providers.length; attempt++) {
        const provider = this.providers[this.currentProviderIndex];
        attemptedProviders.push(provider.name);

        if (!provider.isAvailable()) {
          errorDetails.push(`${provider.name}: unavailable`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          continue;
        }

        try {
          rawOutput = await provider.normalize(sanitizedText, targetSchema, options);
          usedProvider = provider.name;
          succeeded = true;
          if (attempt > 0) {
            usedFallback = true;
          }
          break;
        } catch (err: any) {
          const errMsg = err.message || 'Unknown provider error';
          console.warn(`[Normalizer] Provider ${provider.name} failed: ${errMsg}`);
          errorDetails.push(`${provider.name}: ${errMsg}`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
        }
      }

      if (!succeeded) {
        throw new NormalizerError(
          `All AI providers failed in cascading fallback. Attempted: [${attemptedProviders.join(
            ', '
          )}]. Details: ${errorDetails.join(' | ')}`,
          ErrorType.API_ERROR
        );
      }
    }

    const parsedData = PropertyValidator.extractJson(rawOutput);
    return {
      data: parsedData,
      rawOutput,
      provider: usedProvider,
      usedFallback,
      attemptedProviders
    };
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

    // 3. Actions & Reactions (if present)
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

    // 6. Run full property validation & formatting on unified document
    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      mergedData,
      fullSchema,
      options
    );

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

    return {
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      provider: headerRes.provider,
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
   * Reset providers to available state
   */
  resetProviders(): void {
    this.currentProviderIndex = 0;
  }

  /**
   * Get list of currently available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isAvailable()).map(p => p.name);
  }

  /**
   * Get all provider names with status
   */
  getAllProvidersInfo(): Array<{ name: string; available: boolean }> {
    return this.providers.map(p => ({
      name: p.name,
      available: p.isAvailable()
    }));
  }
}
