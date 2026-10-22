/**
 * Slices large RPG entity texts into smaller semantic sections
 * to prevent AI output token exhaustion and hallucination.
 */

export interface MonsterSections {
  header: string;
  traits?: string;
  actions?: string;
  bonusActions?: string;
  reactions?: string;
  legendary?: string;
}

export class EntitySectioner {
  /**
   * Slices a monster stat block into semantic sections:
   * 1. header (core stats, AC, HP, abilities, saves, skills, senses, CR)
   * 2. traits (passive abilities, innate spellcasting)
   * 3. actions (attacks, multiattack)
   * 4. bonusActions (bonus actions)
   * 5. reactions (reaction triggers and effects)
   * 6. legendary (legendary actions, lair actions)
   */
  static splitMonster(rawText: string): MonsterSections {
    const text = rawText.trim();

    // Markers for section headings
    const traitsMarker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Traits|Special\s+Traits):?(?:\*\*)?\s*(?:\n|$)/i;
    const actionsMarker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Actions?:?(?:\*\*)?\s*(?:\n|$)/i;
    const bonusActionsMarker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Bonus\s+Actions?:?(?:\*\*)?\s*(?:\n|$)/i;
    const reactionsMarker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Reactions?:?(?:\*\*)?\s*(?:\n|$)/i;
    const legendaryMarker = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Legendary\s+Actions?|Mythic\s+Actions?):?(?:\*\*)?\s*(?:\n|$)/i;

    const markers = [
      { type: 'traits' as const, match: traitsMarker.exec(text) },
      { type: 'actions' as const, match: actionsMarker.exec(text) },
      { type: 'bonusActions' as const, match: bonusActionsMarker.exec(text) },
      { type: 'reactions' as const, match: reactionsMarker.exec(text) },
      { type: 'legendary' as const, match: legendaryMarker.exec(text) }
    ].filter((m): m is { type: keyof Omit<MonsterSections, 'header'>; match: RegExpExecArray } => m.match !== null);

    // If no distinct section markers found, return single header chunk
    if (markers.length === 0) {
      return { header: text };
    }

    markers.sort((a, b) => a.match.index - b.match.index);

    const sections: MonsterSections = {
      header: text.substring(0, markers[0].match.index).trim()
    };

    for (let i = 0; i < markers.length; i++) {
      const cur = markers[i];
      const next = markers[i + 1];
      const start = cur.match.index + cur.match[0].length;
      const end = next ? next.match.index : text.length;
      const content = text.substring(start, end).trim();
      if (content) {
        sections[cur.type] = content;
      }
    }

    return sections;
  }

  /**
   * Slices a class definition into core identity and level progression tiers
   */
  static splitClass(rawText: string): { header: string; tiers: string[] } {
    const text = rawText.trim();
    const levelMatch = /(?:^|\n)(?:Level\s*1\b|###\s*Level\s*1\b|\*\*Level\s*1\b)/i.exec(text);

    if (!levelMatch) {
      return { header: text, tiers: [] };
    }

    const header = text.substring(0, levelMatch.index).trim();
    const progressionText = text.substring(levelMatch.index).trim();

    // Chunk progression by levels: Tier 1 (1-4), Tier 2 (5-10), Tier 3 (11-16), Tier 4 (17-20)
    const tierRegex = /(?:^|\n)(?:Level\s*(?:1|5|11|17)\b|###\s*Level\s*(?:1|5|11|17)\b)/gi;
    const tierMatches: number[] = [];
    let tm: RegExpExecArray | null;

    while ((tm = tierRegex.exec(progressionText)) !== null) {
      tierMatches.push(tm.index);
    }

    if (tierMatches.length <= 1) {
      return { header, tiers: [progressionText] };
    }

    const tiers: string[] = [];
    for (let i = 0; i < tierMatches.length; i++) {
      const start = tierMatches[i];
      const end = tierMatches[i + 1] !== undefined ? tierMatches[i + 1] : progressionText.length;
      tiers.push(progressionText.substring(start, end).trim());
    }

    return { header, tiers };
  }

  /**
   * Checks if an entity text is large enough to warrant sectioning
   */
  static shouldSection(text: string, template?: string, customThreshold?: number): boolean {
    const tmpl = (template || '').toLowerCase().trim();
    const len = text.length;

    if (tmpl === 'monster') {
      const threshold = customThreshold !== undefined ? customThreshold : 6000;
      return len > threshold && /(?:^|\n)(?:Actions|###\s*Actions|\*\*Actions\*\*)/i.test(text);
    }

    if (tmpl === 'species' || tmpl === 'race') {
      const threshold = customThreshold !== undefined ? customThreshold : 15000;
      return len > threshold;
    }

    if (tmpl === 'class') {
      const threshold = customThreshold !== undefined ? customThreshold : 2000;
      return len > threshold && /(?:^|\n)Level\s*1\b/i.test(text);
    }

    return len > (customThreshold !== undefined ? customThreshold : 4000);
  }
}
