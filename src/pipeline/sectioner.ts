/**
 * Slices large RPG entity texts into smaller semantic sections
 * to prevent AI output token exhaustion and hallucination.
 */

export interface MonsterSections {
  header: string;
  traits?: string;
  actions?: string;
  reactions?: string;
  legendary?: string;
}

export class EntitySectioner {
  /**
   * Slices a monster stat block into semantic sections:
   * 1. header (core stats, AC, HP, abilities, saves, skills, senses, CR)
   * 2. traits (passive abilities, innate spellcasting)
   * 3. actions (attacks, multiattack, bonus actions)
   * 4. reactions (reaction triggers and effects)
   * 5. legendary (legendary actions, lair actions)
   */
  static splitMonster(rawText: string): MonsterSections {
    const text = rawText.trim();

    // Markers for section headings
    const actionsMarker = /(?:^|\n)(?:Actions|###\s*Actions|\*\*Actions\*\*)(?:\n|$)/i;
    const bonusActionsMarker = /(?:^|\n)(?:Bonus\s+Actions|###\s*Bonus\s+Actions|\*\*Bonus\s+Actions\*\*)(?:\n|$)/i;
    const reactionsMarker = /(?:^|\n)(?:Reactions|###\s*Reactions|\*\*Reactions\*\*)(?:\n|$)/i;
    const legendaryMarker = /(?:^|\n)(?:Legendary\s+Actions|###\s*Legendary\s+Actions|\*\*Legendary\s+Actions\*\*|Mythic\s+Actions)(?:\n|$)/i;
    const traitsMarker = /(?:^|\n)(?:Traits|###\s*Traits|\*\*Traits\*\*|Special\s+Traits)(?:\n|$)/i;

    // Find indices
    const traitsMatch = traitsMarker.exec(text);
    const actionsMatch = actionsMarker.exec(text);
    const bonusMatch = bonusActionsMarker.exec(text);
    const reactionsMatch = reactionsMarker.exec(text);
    const legendaryMatch = legendaryMarker.exec(text);

    // If no distinct action markers found, return single header chunk
    if (!actionsMatch && !legendaryMatch && !traitsMatch && !reactionsMatch && !bonusMatch) {
      return { header: text };
    }

    // 1. Legendary section
    let legendaryStartIndex = -1;
    if (legendaryMatch) {
      legendaryStartIndex = legendaryMatch.index;
    }

    // 2. Reactions section
    let reactionsStartIndex = -1;
    let reactionsEndIndex = -1;
    if (reactionsMatch) {
      reactionsStartIndex = reactionsMatch.index;
      reactionsEndIndex = legendaryStartIndex !== -1 ? legendaryStartIndex : text.length;
    }

    // 3. Actions section (Actions or Bonus Actions)
    let actionsStartIndex = -1;
    let actionsEndIndex = -1;
    const firstActionIdx = Math.min(
      actionsMatch ? actionsMatch.index : Infinity,
      bonusMatch ? bonusMatch.index : Infinity
    );
    if (firstActionIdx !== Infinity) {
      actionsStartIndex = firstActionIdx;
      actionsEndIndex = Math.min(
        reactionsStartIndex !== -1 && reactionsStartIndex > actionsStartIndex ? reactionsStartIndex : Infinity,
        legendaryStartIndex !== -1 && legendaryStartIndex > actionsStartIndex ? legendaryStartIndex : Infinity,
        text.length
      );
    }

    // 4. Traits section
    let traitsStartIndex = -1;
    let traitsEndIndex = -1;
    if (traitsMatch) {
      traitsStartIndex = traitsMatch.index;
      traitsEndIndex = Math.min(
        actionsStartIndex !== -1 ? actionsStartIndex : Infinity,
        reactionsStartIndex !== -1 ? reactionsStartIndex : Infinity,
        legendaryStartIndex !== -1 ? legendaryStartIndex : Infinity,
        text.length
      );
    }

    // Determine header end index (earliest section)
    const firstSectionIdx = Math.min(
      traitsStartIndex !== -1 ? traitsStartIndex : Infinity,
      actionsStartIndex !== -1 ? actionsStartIndex : Infinity,
      reactionsStartIndex !== -1 ? reactionsStartIndex : Infinity,
      legendaryStartIndex !== -1 ? legendaryStartIndex : Infinity
    );
    const headerEndIndex = firstSectionIdx !== Infinity ? firstSectionIdx : text.length;

    const sections: MonsterSections = {
      header: text.substring(0, headerEndIndex).trim()
    };

    if (traitsStartIndex !== -1 && traitsEndIndex > traitsStartIndex) {
      const traitsText = text.substring(traitsStartIndex, traitsEndIndex).trim();
      if (traitsText) sections.traits = traitsText;
    }

    if (actionsStartIndex !== -1 && actionsEndIndex > actionsStartIndex) {
      const actionsText = text.substring(actionsStartIndex, actionsEndIndex).trim();
      if (actionsText) sections.actions = actionsText;
    }

    if (reactionsStartIndex !== -1 && reactionsEndIndex > reactionsStartIndex) {
      const reactionsText = text.substring(reactionsStartIndex, reactionsEndIndex).trim();
      if (reactionsText) sections.reactions = reactionsText;
    }

    if (legendaryStartIndex !== -1) {
      const legText = text.substring(legendaryStartIndex).trim();
      if (legText) sections.legendary = legText;
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
  static shouldSection(text: string, template?: string): boolean {
    const tmpl = (template || '').toLowerCase().trim();
    const len = text.length;

    if (tmpl === 'monster') {
      // If monster text is > 1600 chars and has Actions heading
      return len > 1600 && /(?:^|\n)(?:Actions|###\s*Actions|\*\*Actions\*\*)/i.test(text);
    }

    if (tmpl === 'class') {
      return len > 2000 && /(?:^|\n)Level\s*1\b/i.test(text);
    }

    return len > 4000;
  }
}
