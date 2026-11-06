import axios from 'axios';

/**
 * Free Keyless Translation Pipeline
 * Directly integrates with automatic-translator (on port 3008) if running,
 * or falls back to free public keyless endpoints (MyMemory, LibreTranslate).
 * No signup and no API keys required!
 */
export class FreeTranslator {
  private static localTranslatorUrl = process.env.AUTOMATIC_TRANSLATOR_URL || 'http://localhost:3008/translate';
  private static memoryCache = new Map<string, string>([
    ['en:pt-BR:Cleric', 'Clérigo'],
    ['en:pt-BR:Druid', 'Druida'],
    ['en:pt-BR:Divine Order', 'Ordem Divina'],
    ['en:pt-BR:Primal Order', 'Ordem Primordial'],
    ['en:pt-BR:Blessed Strikes', 'Golpes Abençoados'],
    ['en:pt-BR:Elemental Fury', 'Fúria Elemental'],
    ['en:pt-BR:You have dedicated yourself to one of the following sacred roles of your choice.', 'Você se dedicou a um dos seguintes papéis sagrados de sua escolha.'],
    ['en:pt-BR:You have dedicated yourself to one of the following sacred roles of your choice:', 'Você se dedicou a um dos seguintes papéis sagrados de sua escolha.'],
    ['en:pt-BR:Protector', 'Protetor'],
    ['en:pt-BR:Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.', 'Treinado para a batalha, você ganha proficiência com armas marciais e treina com armaduras pesadas.'],
    ['en:pt-BR:Thaumaturge', 'Taumaturgo'],
    ['en:pt-BR:You know one extra cantrip from the Cleric spell list. In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1).', 'Você conhece um truque extra da lista de magias do Clérigo. Além disso, sua conexão mística com o divino lhe dá um bônus em seus testes de Inteligência (Arcanismo ou Religião). O bônus é igual ao seu modificador de Sabedoria (mínimo de +1).'],
    ['en:pt-BR:Magician', 'Mago'],
    ['en:pt-BR:You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals your Wisdom modifier (minimum bonus of +1).', 'Você conhece um truque extra da lista de magias do Druida. Além disso, sua conexão mística com a natureza lhe dá um bônus em seus testes de Inteligência (Arcanismo ou Natureza). O bônus é igual ao seu modificador de Sabedoria (bônus mínimo de +1).'],
    ['en:pt-BR:You know one extra cantrip from the Druid spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks. The bonus equals your Wisdom modifier (minimum of +1).', 'Você conhece um truque extra da lista de magias do Druida. Além disso, sua conexão mística com a natureza lhe dá um bônus em seus testes de Inteligência (Arcanismo ou Natureza). O bônus é igual ao seu modificador de Sabedoria (mínimo de +1).'],
    ['en:pt-BR:Warden', 'Guardião'],
    ['en:pt-BR:Trained for battle, you gain proficiency with Martial weapons and training with Medium armor.', 'Treinado para a batalha, você ganha proficiência com armas marciais e treina com armadura média.'],
    ['en:pt-BR:Divine Strike', 'Golpe Divino'],
    ['en:pt-BR:Potent Spellcasting', 'Conjuração Potente'],
    ['en:pt-BR:Primal Strike', 'Golpe Primordial']
  ]);
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
        { timeout: 3000, signal: AbortSignal.timeout(3000) }
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
        timeout: 6000,
        signal: AbortSignal.timeout(6000),
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

    // Translate name for entity if missing or untranslated
    if (entity.name && (!loc.name || loc.name === entity.name)) {
      loc.name = await this.translateText(entity.name, targetLocale);
    }

    // Translate type
    if (entity.type && (!loc.type || loc.type === entity.type)) {
      loc.type = await this.translateText(entity.type, targetLocale);
    }

    // Translate alignment
    if (entity.alignment && (!loc.alignment || loc.alignment === entity.alignment)) {
      loc.alignment = await this.translateText(entity.alignment, targetLocale);
    }

    // Translate description if missing or untranslated
    if (entity.description && (!loc.description || loc.description === entity.description)) {
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

    // Helper to enrich a single feature (and its options[]) with targetLocale translations
    const enrichFeatureTranslation = async (f: any) => {
      if (!f || typeof f !== 'object') return;
      if (!f.translations || typeof f.translations !== 'object') {
        f.translations = {};
      }
      if (!f.translations[targetLocale] || typeof f.translations[targetLocale] !== 'object') {
        f.translations[targetLocale] = {};
      }
      const fLoc = f.translations[targetLocale];
      if (f.name && (!fLoc.name || fLoc.name === f.name)) {
        fLoc.name = await this.translateText(f.name, targetLocale);
      }
      if (f.description && (!fLoc.description || fLoc.description === f.description)) {
        fLoc.description = await this.translateText(f.description, targetLocale);
      }
      if (Array.isArray(f.options)) {
        for (const opt of f.options) {
          if (!opt || typeof opt !== 'object') continue;
          if (!opt.translations || typeof opt.translations !== 'object') {
            opt.translations = {};
          }
          const existingOptLoc = opt.translations[targetLocale] && typeof opt.translations[targetLocale] === 'object'
            ? opt.translations[targetLocale]
            : {};
          const optName = opt.name
            ? (existingOptLoc.name && existingOptLoc.name !== opt.name
                ? existingOptLoc.name
                : await this.translateText(opt.name, targetLocale))
            : undefined;
          const optDesc = opt.description
            ? (existingOptLoc.description && existingOptLoc.description !== opt.description
                ? existingOptLoc.description
                : await this.translateText(opt.description, targetLocale))
            : undefined;
          opt.translations[targetLocale] = {
            ...(optName ? { name: optName } : {}),
            ...(optDesc ? { description: optDesc } : {})
          };
        }
      }
    };

    if (Array.isArray(entity.features)) {
      for (const f of entity.features) {
        await enrichFeatureTranslation(f);
      }
      if (Array.isArray(loc.features)) {
        loc.features = entity.features.map((f: any, idx: number) => {
          const prev = loc.features[idx] && typeof loc.features[idx] === 'object' ? loc.features[idx] : {};
          const fLoc = f?.translations?.[targetLocale];
          return {
            ...prev,
            name: fLoc?.name || prev.name || f?.name || '',
            description: fLoc?.description || f?.description || ''
          };
        });
      }
    }

    if (Array.isArray(entity.levelProgression)) {
      for (const lp of entity.levelProgression) {
        if (lp && Array.isArray(lp.features)) {
          for (const f of lp.features) {
            await enrichFeatureTranslation(f);
          }
        }
      }
      if (Array.isArray(loc.levelProgression)) {
        for (const locLp of loc.levelProgression) {
          if (!locLp || !Array.isArray(locLp.features)) continue;
          const matchLp = entity.levelProgression.find((lp: any) => lp?.level === locLp.level);
          if (matchLp && Array.isArray(matchLp.features)) {
            locLp.features = locLp.features.map((lf: any, idx: number) => {
              const srcF = matchLp.features[idx];
              const fLoc = srcF?.translations?.[targetLocale];
              return {
                ...lf,
                name: fLoc?.name || lf?.name || srcF?.name || '',
                description: fLoc?.description || lf?.description || srcF?.description || ''
              };
            });
          }
        }
      }
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
