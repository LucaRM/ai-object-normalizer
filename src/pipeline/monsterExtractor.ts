/**
 * Utility to extract and sanitize 2024 / 2014 D&D monster stat block fields
 * such as embedded saving throws from ability tables, initiative from headers, and type cleaning.
 */
export class MonsterStatExtractor {
  /**
   * Extracts initiative from raw stat block text (e.g. "AC 20 Initiative +16 (26)"),
   * falling back to Dexterity modifier calculation if not explicitly given.
   */
  static extractInitiative(text: string, dexterityScore?: number): string {
    if (!text || typeof text !== 'string') {
      if (dexterityScore !== undefined && !isNaN(dexterityScore)) {
        const dexMod = Math.floor((dexterityScore - 10) / 2);
        return `${dexMod >= 0 ? '+' : ''}${dexMod} (${10 + dexMod})`;
      }
      return '+0 (10)';
    }

    const initMatch = text.match(/(?:Initiative|Init\.?)\s*[:]?\s*([+\-]?\d+(?:\s*\(\d+\))?)/i);
    if (initMatch) {
      return initMatch[1].trim();
    }

    if (dexterityScore !== undefined && !isNaN(dexterityScore)) {
      const dexMod = Math.floor((dexterityScore - 10) / 2);
      return `${dexMod >= 0 ? '+' : ''}${dexMod} (${10 + dexMod})`;
    }

    return '+0 (10)';
  }

  /**
   * Extracts saving throws from both:
   * 1. 2014 explicit format: "Saving Throws Dex +9, Wis +11"
   * 2. 2024 ability score table:
   *    Ability Score Mod Save
   *    Dex 15 +2 +9   <-- Save (+9) > Mod (+2): Proficient!
   *    Wis 19 +4 +11  <-- Save (+11) > Mod (+4): Proficient!
   * Handles both horizontal rows and vertical newline-separated tables.
   */
  static extractSavingThrows(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const savingThrows: string[] = [];

    // 1. 2014 explicit line
    const savesMatch = text.match(/(?:^|\n)\s*(?:[*_]{1,3})?Saving\s+Throws?\s*[:]?\s*(?:[*_]{1,3})?\s*([^\n;]+)/i);
    if (savesMatch) {
      const parts = savesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (/^(?:Str|Dex|Con|Int|Wis|Cha|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*[+\-]\d+/i.test(p)) {
          if (!savingThrows.includes(p)) savingThrows.push(p);
        }
      }
    }

    // 2. 2024 ability table (horizontal and vertical formats)
    const abilityDefs = [
      { short: 'Str', names: ['str', 'strength'] },
      { short: 'Dex', names: ['dex', 'dexterity'] },
      { short: 'Con', names: ['con', 'constitution'] },
      { short: 'Int', names: ['int', 'intelligence'] },
      { short: 'Wis', names: ['wis', 'wisdom'] },
      { short: 'Cha', names: ['cha', 'charisma'] }
    ];

    for (const ab of abilityDefs) {
      const namesPattern = ab.names.join('|');
      // Matches: AbilityName followed by Score (int), Mod (+X or -X or X), Save (+Y or -Y or Y)
      const regex = new RegExp(
        `\\b(?:${namesPattern})\\b[\\s\\n|:]*?(\\d+)[\\s\\n|:]*?([+\\-]?\\d+)[\\s\\n|:]*?([+\\-]?\\d+)`,
        'i'
      );
      const match = text.match(regex);
      if (match) {
        const score = parseInt(match[1], 10);
        const mod = parseInt(match[2], 10);
        const save = parseInt(match[3], 10);
        const baseMod = Math.floor((score - 10) / 2);

        // Proficient if Save > Mod or Save > baseMod (e.g. +9 vs +2, or +12 vs +6)
        if (save > mod || save > baseMod) {
          const saveStr = `${ab.short} ${save >= 0 ? '+' : ''}${save}`;
          if (!savingThrows.includes(saveStr)) {
            savingThrows.push(saveStr);
          }
        }
      }
    }

    return savingThrows;
  }

  /**
   * Sanitizes creature type to avoid artifacts like "or Medium humanoid, any alignment"
   * -> "Humanoid"
   */
  static cleanType(type: string): string {
    if (!type || typeof type !== 'string') return 'Beast';
    let clean = type.replace(/^(?:or|ou)\s+/i, '').trim();
    // Strip leading size words if type was prefixed by size (e.g. "Medium humanoid" -> "humanoid")
    clean = clean.replace(/^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+/i, '').trim();
    // Strip trailing alignment or trailing comma details if accidentally captured (e.g. "Humanoid, any alignment" -> "Humanoid")
    if (clean.includes(',')) {
      clean = clean.split(',')[0].trim();
    }
    // Capitalize first letter
    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean || 'Humanoid';
  }

  /**
   * Sanitizes creature size
   */
  static cleanSize(size: string): string {
    if (!size || typeof size !== 'string') return 'Medium';
    const lower = size.toLowerCase();
    if (lower.includes('tiny')) return 'Tiny';
    if (lower.includes('small') && !lower.includes('medium')) return 'Small';
    if (lower.includes('large')) return 'Large';
    if (lower.includes('huge')) return 'Huge';
    if (lower.includes('gargantuan')) return 'Gargantuan';
    return 'Medium';
  }
}
