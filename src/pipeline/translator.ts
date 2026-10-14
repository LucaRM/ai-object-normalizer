import axios from 'axios';

/**
 * Free Keyless Translation Pipeline
 * Directly integrates with automatic-translator (on port 3008) if running,
 * or falls back to free public keyless endpoints (MyMemory, LibreTranslate).
 * No signup and no API keys required!
 */
export class FreeTranslator {
  private static localTranslatorUrl = process.env.AUTOMATIC_TRANSLATOR_URL || 'http://localhost:3008/translate';
  private static memoryCache = new Map<string, string>();
  private static myMemoryCooldownUntil = 0;

  /**
   * Translate a single string into the target locale without requiring an API key.
   */
  static async translateText(
    text: string,
    targetLocale: string,
    sourceLocale: string = 'en'
  ): Promise<string> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return text;
    }

    const trimmed = text.trim();
    const cacheKey = `${sourceLocale}:${targetLocale}:${trimmed}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 1. Try local automatic-translator (port 3008) if running
    try {
      const res = await axios.post(
        this.localTranslatorUrl,
        {
          text: trimmed,
          options: {
            targetLanguage: targetLocale,
            sourceLanguage: sourceLocale
          }
        },
        { timeout: 3000 }
      );

      if (res.data?.translatedText) {
        const result = res.data.translatedText.trim();
        this.memoryCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Local automatic-translator is not running or timed out, continue to free web endpoint
    }

    // 2. Try MyMemory Free API (zero-signup, zero-key)
    if (Date.now() < this.myMemoryCooldownUntil) {
      return trimmed;
    }

    try {
      // If query is longer than 450 chars, split into sentences to respect MyMemory 500-char limit
      if (trimmed.length > 450) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmed];
        const translatedParts: string[] = [];
        for (const s of sentences) {
          translatedParts.push(await this.translateText(s.trim(), targetLocale, sourceLocale));
        }
        const combined = translatedParts.join(' ').trim();
        this.memoryCache.set(cacheKey, combined);
        return combined;
      }

      const langpair = `${sourceLocale}|${targetLocale}`;
      const res = await axios.get('https://api.mymemory.translated.net/get', {
        params: {
          q: trimmed,
          langpair
        },
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const translated = res.data?.responseData?.translatedText;
      if (
        translated &&
        typeof translated === 'string' &&
        !translated.includes('MYMEMORY WARNING') &&
        !translated.includes('QUERY LENGTH LIMIT EXCEEDED') &&
        !translated.includes('INVALID USER KEY')
      ) {
        const result = translated.trim();
        this.memoryCache.set(cacheKey, result);
        return result;
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        this.myMemoryCooldownUntil = Date.now() + 60000;
        console.warn(`[FreeTranslator] MyMemory rate-limited (429). Placed on cooldown for 60s.`);
      } else {
        console.warn(`[FreeTranslator] MyMemory failed for "${trimmed.slice(0, 30)}...": ${err.message}`);
      }
    }

    // 3. Fallback: return original text
    return trimmed;
  }

  /**
   * Enriches an extracted entity's translations object using free, keyless translation.
   */
  static async enrichTranslations(entity: any, targetLocale?: string): Promise<void> {
    if (!targetLocale || !entity || typeof entity !== 'object') {
      return;
    }

    if (!entity.translations) {
      entity.translations = {};
    }
    if (!entity.translations[targetLocale]) {
      entity.translations[targetLocale] = {};
    }

    const loc = entity.translations[targetLocale];

    // Always translate name for entity
    if (entity.name) {
      loc.name = await this.translateText(entity.name, targetLocale);
    }

    // Translate type
    if (entity.type) {
      loc.type = await this.translateText(entity.type, targetLocale);
    }

    // Translate alignment
    if (entity.alignment) {
      loc.alignment = await this.translateText(entity.alignment, targetLocale);
    }

    // Translate description
    if (entity.description) {
      loc.description = await this.translateText(entity.description, targetLocale);
    }

    // Translate traits array
    if (Array.isArray(entity.traits)) {
      loc.traits = await Promise.all(
        entity.traits.map(async (t: any) => ({
          name: t.name ? await this.translateText(t.name, targetLocale) : '',
          description: t.description ? await this.translateText(t.description, targetLocale) : ''
        }))
      );
    }

    // Translate actions array
    if (Array.isArray(entity.actions)) {
      loc.actions = await Promise.all(
        entity.actions.map(async (a: any) => ({
          name: a.name ? await this.translateText(a.name, targetLocale) : '',
          description: a.description ? await this.translateText(a.description, targetLocale) : ''
        }))
      );
    }

    // Translate bonus actions array
    if (Array.isArray(entity.bonusActions)) {
      loc.bonusActions = await Promise.all(
        entity.bonusActions.map(async (b: any) => ({
          name: b.name ? await this.translateText(b.name, targetLocale) : '',
          description: b.description ? await this.translateText(b.description, targetLocale) : ''
        }))
      );
    }

    // Translate reactions array
    if (Array.isArray(entity.reactions)) {
      loc.reactions = await Promise.all(
        entity.reactions.map(async (r: any) => ({
          name: r.name ? await this.translateText(r.name, targetLocale) : '',
          description: r.description ? await this.translateText(r.description, targetLocale) : ''
        }))
      );
    }

    // Translate legendary actions array
    if (Array.isArray(entity.legendaryActions)) {
      loc.legendaryActions = await Promise.all(
        entity.legendaryActions.map(async (l: any) => ({
          name: l.name ? await this.translateText(l.name, targetLocale) : '',
          description: l.description ? await this.translateText(l.description, targetLocale) : ''
        }))
      );
    }

    // Apply metadata
    loc._metadata = {
      locale: targetLocale,
      translatedAt: new Date().toISOString(),
      source: 'AI_TRANSLATION',
      quality: 'DRAFT'
    };
    loc.metadata = {
      reviewed: false,
      translatedBy: 'ai'
    };
  }
}
