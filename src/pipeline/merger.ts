/**
 * Stitches and merges normalized sections back into a complete, unified entity document.
 */

export class EntityMerger {
  /**
   * Merges sectional monster objects (header, traits, actions, legendary)
   * into a single, cohesive Monster document.
   */
  static mergeMonster(parts: {
    header: any;
    traits?: any;
    actions?: any;
    reactions?: any;
    legendary?: any;
  }): any {
    const merged = { ...(parts.header || {}) };

    // Initialize arrays if missing
    merged.traits = Array.isArray(merged.traits) ? [...merged.traits] : [];
    merged.actions = Array.isArray(merged.actions) ? [...merged.actions] : [];
    merged.bonusActions = Array.isArray(merged.bonusActions) ? [...merged.bonusActions] : [];
    merged.reactions = Array.isArray(merged.reactions) ? [...merged.reactions] : [];
    merged.legendaryActions = Array.isArray(merged.legendaryActions) ? [...merged.legendaryActions] : [];

    // Helper to merge array items deduplicating by item name
    const mergeUniqueByName = (target: any[], source: any[]) => {
      if (!Array.isArray(source)) return;
      for (const item of source) {
        if (!item || !item.name) continue;
        const existingIdx = target.findIndex(
          t => t.name && t.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
        if (existingIdx !== -1) {
          // Replace or extend
          target[existingIdx] = { ...target[existingIdx], ...item };
        } else {
          target.push(item);
        }
      }
    };

    // 1. Merge Traits
    if (parts.traits) {
      const traitsList = parts.traits.traits || (Array.isArray(parts.traits) ? parts.traits : []);
      mergeUniqueByName(merged.traits, traitsList);
    }

    // 2. Merge Actions & Reactions
    if (parts.actions) {
      const actionsList = parts.actions.actions || (Array.isArray(parts.actions) ? parts.actions : []);
      mergeUniqueByName(merged.actions, actionsList);

      if (parts.actions.reactions) {
        mergeUniqueByName(merged.reactions, parts.actions.reactions);
      }
      if (parts.actions.bonusActions && Array.isArray(parts.actions.bonusActions)) {
        mergeUniqueByName(merged.bonusActions, parts.actions.bonusActions);
      }
    }

    // 2.25 Merge Standalone Bonus Actions section
    if ((parts as any).bonusActions) {
      const bonusList = (parts as any).bonusActions.bonusActions || (Array.isArray((parts as any).bonusActions) ? (parts as any).bonusActions : []);
      mergeUniqueByName(merged.bonusActions, bonusList);
    }

    // 2.5 Merge Standalone Reactions section
    if (parts.reactions) {
      const reactionsList = parts.reactions.reactions || (Array.isArray(parts.reactions) ? parts.reactions : []);
      mergeUniqueByName(merged.reactions, reactionsList);
    }

    // 3. Merge Legendary Actions
    if (parts.legendary) {
      const legList = parts.legendary.legendaryActions || (Array.isArray(parts.legendary) ? parts.legendary : []);
      mergeUniqueByName(merged.legendaryActions, legList);
    }

    // 4. Merge Embedded Translations across sections
    if (!merged.translations) merged.translations = {};

    const mergeSectionTranslations = (sectionData: any) => {
      if (!sectionData || !sectionData.translations) return;

      for (const [locale, trans] of Object.entries<any>(sectionData.translations)) {
        if (!merged.translations[locale]) {
          merged.translations[locale] = { ...trans };
          continue;
        }

        const targetTrans = merged.translations[locale];
        if (trans.traits) {
          targetTrans.traits = targetTrans.traits || [];
          mergeUniqueByName(targetTrans.traits, trans.traits);
        }
        if (trans.actions) {
          targetTrans.actions = targetTrans.actions || [];
          mergeUniqueByName(targetTrans.actions, trans.actions);
        }
        if (trans.bonusActions) {
          targetTrans.bonusActions = targetTrans.bonusActions || [];
          mergeUniqueByName(targetTrans.bonusActions, trans.bonusActions);
        }
        if (trans.reactions) {
          targetTrans.reactions = targetTrans.reactions || [];
          mergeUniqueByName(targetTrans.reactions, trans.reactions);
        }
        if (trans.legendaryActions) {
          targetTrans.legendaryActions = targetTrans.legendaryActions || [];
          mergeUniqueByName(targetTrans.legendaryActions, trans.legendaryActions);
        }
      }
    };

    mergeSectionTranslations(parts.traits);
    mergeSectionTranslations(parts.actions);
    mergeSectionTranslations((parts as any).bonusActions);
    mergeSectionTranslations(parts.reactions);
    mergeSectionTranslations(parts.legendary);

    return merged;
  }

  /**
   * Merges class definition parts (header + progression level tiers)
   */
  static mergeClass(header: any, progressionTiers: any[]): any {
    const merged = { ...header };
    const allFeatures: any[] = [];

    // Flatten level progression
    const levelsMap = new Map<number, any>();

    if (Array.isArray(header.levelProgression)) {
      for (const lvl of header.levelProgression) {
        if (lvl && typeof lvl.level === 'number') {
          levelsMap.set(lvl.level, lvl);
        }
      }
    }

    for (const tier of progressionTiers) {
      if (!tier) continue;
      const list = Array.isArray(tier.levelProgression) ? tier.levelProgression : (Array.isArray(tier) ? tier : []);
      for (const lvl of list) {
        if (lvl && typeof lvl.level === 'number') {
          if (levelsMap.has(lvl.level)) {
            const existing = levelsMap.get(lvl.level);
            existing.features = [...(existing.features || []), ...(lvl.features || [])];
          } else {
            levelsMap.set(lvl.level, lvl);
          }
        }
      }
    }

    merged.levelProgression = Array.from(levelsMap.values()).sort((a, b) => a.level - b.level);
    return merged;
  }
}
