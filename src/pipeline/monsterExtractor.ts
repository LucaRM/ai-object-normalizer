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

  /**
   * Extracts hit die roll formula string (e.g. "23d12 + 138" from "HP 287 (23d12 + 138)")
   */
  static extractHitDie(text: string): string | undefined {
    if (!text || typeof text !== 'string') return undefined;
    const m = text.match(/(?:HP|Hit\s+Points)\s*\d+\s*\(([^)]+)\)/i);
    return m ? m[1].trim() : undefined;
  }

  /**
   * Extracts numeric initiative bonus (e.g. 14 from "+14 (24)" or "+14")
   */
  static extractInitiativeBonus(text: string, dexScore?: number): number {
    if (text && typeof text === 'string') {
      const m = text.match(/Initiative\s*[:]?\s*([+\-]?\d+)/i);
      if (m) return parseInt(m[1], 10);
    }
    if (dexScore !== undefined && !isNaN(dexScore)) {
      return Math.floor((dexScore - 10) / 2);
    }
    return 0;
  }

  /**
   * Extracts structured speed object (e.g. { walk: 40, fly: 80, hover: true })
   */
  static extractSpeedObject(speedStr: string): {
    walk?: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
    hover?: boolean;
  } {
    if (!speedStr || typeof speedStr !== 'string') return { walk: 30 };
    const speedObj: {
      walk?: number;
      fly?: number;
      swim?: number;
      climb?: number;
      burrow?: number;
      hover?: boolean;
    } = {};

    if (/\bhover\b/i.test(speedStr)) {
      speedObj.hover = true;
    }

    const flyMatch = speedStr.match(/Fly\s*(\d+)\s*ft\.?/i);
    if (flyMatch) speedObj.fly = parseInt(flyMatch[1], 10);

    const swimMatch = speedStr.match(/Swim\s*(\d+)\s*ft\.?/i);
    if (swimMatch) speedObj.swim = parseInt(swimMatch[1], 10);

    const climbMatch = speedStr.match(/Climb\s*(\d+)\s*ft\.?/i);
    if (climbMatch) speedObj.climb = parseInt(climbMatch[1], 10);

    const burrowMatch = speedStr.match(/Burrow\s*(\d+)\s*ft\.?/i);
    if (burrowMatch) speedObj.burrow = parseInt(burrowMatch[1], 10);

    const walkMatch = speedStr.match(/(?:(?:walk|stride)\s*)?(\d+)\s*ft\.?/i);
    if (walkMatch) {
      speedObj.walk = parseInt(walkMatch[1], 10);
    } else {
      speedObj.walk = 30;
    }

    return speedObj;
  }

  /**
   * Extracts armor class type/armor description (e.g. "Natural Armor" or "(Chain Mail, Shield)")
   */
  static extractArmorClassType(text: string): string | undefined {
    if (!text || typeof text !== 'string') return undefined;
    const m = text.match(/(?:AC|Armor\s+Class)\s*\d+\s*\(([^)]+)\)/i);
    return m ? m[1].trim() : undefined;
  }

  /**
   * Extracts customType description string (e.g. "Huge Fiend (Demon)" or "Medium or Small Humanoid")
   */
  static extractCustomType(text: string): string | undefined {
    if (!text || typeof text !== 'string') return undefined;
    const sizeTypeRegex = /(?:^|\n)([^\n]+?)\s*\n((?:(?:or|ou)\s+)?(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+[^\n,]+)(?:,\s*[^\n]+)?\s*\n(?:AC|Armor\s+Class)/i;
    const m = text.match(sizeTypeRegex);
    if (m) {
      return m[2].replace(/^(?:or|ou)\s+/i, '').trim();
    }
    return undefined;
  }

  /**
   * Extracts gear items array (e.g. ["Pistol", "Scimitar", "Studded Leather Armor"])
   */
  static extractGear(text: string): string[] {
    if (!text || typeof text !== 'string') return [];
    const m = text.match(/Gear\s*[\n:]?\s*([^\n]+)/i);
    if (m) {
      return m[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * Extracts passive perception integer score
   */
  static extractPassivePerception(text: string, senses?: string, wisScore?: number): number {
    const combined = `${senses || ''} ${text || ''}`;
    const m = combined.match(/Passive\s+Perception\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    if (wisScore !== undefined && !isNaN(wisScore)) {
      return 10 + Math.floor((wisScore - 10) / 2);
    }
    return 10;
  }

  /**
   * Extracts legendary action uses integer count (e.g. 3 from "Legendary Action Uses: 3 (4 in Lair)")
   */
  static extractLegendaryActionUses(text: string): number | undefined {
    if (!text || typeof text !== 'string') return undefined;
    const m = text.match(/Legendary\s+Action\s+Uses:\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : undefined;
  }

  /**
   * Extracts defense and immunity arrays
   */
  static extractDamageLists(text: string): {
    damageResistances: string[];
    damageImmunities: string[];
    damageVulnerabilities: string[];
    conditionImmunities: string[];
  } {
    let damageResistances: string[] = [];
    let damageImmunities: string[] = [];
    let damageVulnerabilities: string[] = [];
    let conditionImmunities: string[] = [];

    if (!text || typeof text !== 'string') {
      return { damageResistances, damageImmunities, damageVulnerabilities, conditionImmunities };
    }

    const resMatch = text.match(/(?:Damage\s+Resistances|Resistances)\s*[\n:]?\s*([^\n;]+)/i);
    if (resMatch) {
      damageResistances = resMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    const vulMatch = text.match(/(?:Damage\s+Vulnerabilities|Vulnerabilities)\s*[\n:]?\s*([^\n;]+)/i);
    if (vulMatch) {
      damageVulnerabilities = vulMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    const dmgImmMatch = text.match(/Damage\s+Immunities\s*[\n:]?\s*([^\n;]+)/i);
    if (dmgImmMatch) {
      damageImmunities = dmgImmMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    const condImmMatch = text.match(/Condition\s+Immunities\s*[\n:]?\s*([^\n]+)/i);
    if (condImmMatch) {
      conditionImmunities = condImmMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    // Unified format: "Immunities Fire, Poison; Charmed, Frightened, Poisoned"
    const uniMatch = text.match(/(?:^|\n)Immunities\s*[\n:]?\s*([^\n]+)/i);
    if (uniMatch) {
      const full = uniMatch[1].trim();
      if (full.includes(';')) {
        const [dPart, cPart] = full.split(';');
        if (damageImmunities.length === 0) {
          damageImmunities = dPart.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (conditionImmunities.length === 0) {
          conditionImmunities = cPart.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else {
        const conditionsList = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
        const items = full.split(',').map(s => s.trim()).filter(Boolean);
        const isCond = items.some(it => conditionsList.includes(it.toLowerCase()));
        if (isCond && conditionImmunities.length === 0) {
          conditionImmunities = items;
        } else if (!isCond && damageImmunities.length === 0) {
          damageImmunities = items;
        }
      }
    }

    return { damageResistances, damageImmunities, damageVulnerabilities, conditionImmunities };
  }
}
