import { NormalizerProvider, NormalizeOptions } from '../types';
import { MONSTER_TEMPLATE } from '../templates/monster';
import { WEAPON_TEMPLATE } from '../templates/weapon';
import { SPELL_TEMPLATE } from '../templates/spell';
import { MAGICAL_ITEM_TEMPLATE } from '../templates/magicalItem';

export class MockProvider implements NormalizerProvider {
  public name = 'Deterministic / Rule-Based Extractor';
  private available = true;

  constructor(available: boolean = true) {
    this.available = available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    // 0. Sectional sub-schemas (chunked monster extraction)
    if (schema && schema.traits !== undefined && schema.armorClass === undefined) {
      return this.extractSectionalTraits(text);
    }
    if (schema && schema.reactions !== undefined && schema.actions === undefined && schema.armorClass === undefined) {
      return this.extractSectionalReactions(text);
    }
    if (schema && schema.bonusActions !== undefined && schema.actions === undefined && schema.armorClass === undefined) {
      return this.extractSectionalBonusActions(text);
    }
    if (schema && (schema.actions !== undefined || schema.reactions !== undefined) && schema.armorClass === undefined) {
      return this.extractSectionalActions(text);
    }
    if (schema && schema.legendaryActions !== undefined && schema.armorClass === undefined) {
      return this.extractSectionalLegendary(text);
    }

    const tmpl = (options.template || '').toLowerCase().trim();

    // 1. Monster
    if (tmpl === 'monster' || text.toLowerCase().includes('armor class') || text.toLowerCase().includes('hit points')) {
      return this.extractMonsterStatBlock(text, schema, options);
    }

    // 2. Spell
    if (tmpl === 'spell' || text.toLowerCase().includes('casting time') || text.toLowerCase().includes('evocation')) {
      return this.extractSpell(text, schema, options);
    }

    // 3. Magical Item
    if (tmpl === 'magical-item' || tmpl === 'magicalitem' || text.toLowerCase().includes('wondrous item') || text.toLowerCase().includes('requires attunement')) {
      return this.extractMagicalItem(text, schema, options);
    }

    // 4. Weapon
    if (tmpl === 'weapon' || text.toLowerCase().includes('versatile') || text.toLowerCase().includes('mastery:')) {
      return this.extractWeapon(text, schema, options);
    }

    // Generic heuristic normalization
    return this.extractGenericObject(text, schema, options);
  }

  private extractSpell(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Unknown Spell';
    const descLines = lines.slice(1).filter(l => !/^(casting time|range|components|duration):/i.test(l));
    const description = descLines.join('\n\n') || text.trim();

    const castingTimeMatch = text.match(/Casting Time:\s*([^\n]+)/i);
    const rangeMatch = text.match(/Range:\s*([^\n]+)/i);
    const componentsMatch = text.match(/Components:\s*([^\n]+)/i);
    const durationMatch = text.match(/Duration:\s*([^\n]+)/i);

    const clone = {
      ...SPELL_TEMPLATE,
      ...schema,
      name,
      description,
      castingTime: castingTimeMatch ? castingTimeMatch[1].trim() : '1 action',
      range: rangeMatch ? rangeMatch[1].trim() : 'Self',
      components: componentsMatch ? componentsMatch[1].trim() : 'V, S',
      duration: durationMatch ? durationMatch[1].trim() : 'Instantaneous'
    };

    return JSON.stringify(clone, null, 2);
  }

  private extractMagicalItem(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Unknown Magical Item';
    const descLines = lines.slice(1).filter(l => !/^(wondrous item|weapon|armor|ring|rod|scroll|staff|wand)/i.test(l));

    const clone = {
      ...MAGICAL_ITEM_TEMPLATE,
      ...schema,
      name,
      description: descLines.join('\n\n') || text.trim()
    };

    return JSON.stringify(clone, null, 2);
  }

  private extractWeapon(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Weapon';

    const dmgMatch = text.match(/Damage:\s*([0-9d+\-\s]+(?:[a-zA-Z]+)?)/i);
    const masteryMatch = text.match(/Mastery:\s*([^\n]+)/i);

    const clone = {
      ...WEAPON_TEMPLATE,
      ...schema,
      name,
      ...(dmgMatch && { damage: dmgMatch[1].trim() }),
      ...(masteryMatch && { mastery: masteryMatch[1].trim() })
    };

    return JSON.stringify(clone, null, 2);
  }

  private extractMonsterStatBlock(text: string, schema: any, options: NormalizeOptions): string {
    // 1. Sanitize text and markdown links: [Creature](url) -> Creature
    let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If text contains multiple monsters, isolate the first monster's stat block
    const monsterHeaderRegex = /(?:^|\n)([A-Z0-9][A-Za-z0-9'\s\-–—/]+?)\s*\n((?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+(?:Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)(?:\s*\([^\)]+\))?[^\n]*)/gi;
    const matches: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = monsterHeaderRegex.exec(cleaned)) !== null) {
      const lookahead = cleaned.slice(m.index, m.index + 500);
      if (/(?:AC|Armor\s+Class)\s*[\n:]?\s*\d+/i.test(lookahead)) {
        matches.push(m.index);
      }
    }
    if (matches.length > 1) {
      cleaned = cleaned.slice(0, matches[1]).trim();
    }

    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

    // 2. Size, Type, Alignment, and True Creature Name
    let size = 'Medium';
    let type = 'Beast';
    let alignment = 'Unaligned';
    let name = lines[0] || 'Unknown Creature';

    const sizeTypeRegex = /^((?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?)\s+([^,]+)(?:,\s*(.+))?$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(sizeTypeRegex);
      if (match) {
        size = match[1].trim();
        type = match[2].trim();
        if (match[3]) alignment = match[3].trim();
        // The monster's authentic name immediately precedes the size/type line
        if (i > 0 && lines[i - 1]) {
          name = lines[i - 1].replace(/^[—–-]\s*/, '').trim();
        }
        break;
      }
    }

    // AC: Matches "Armor Class 16", "AC 16", "AC 16 Initiative +3 (13)"
    const acMatch = cleaned.match(/(?:Armor Class|AC)\s*[\n:]?\s*(\d+)/i);
    const armorClass = acMatch ? parseInt(acMatch[1], 10) : 10;

    // HP: Matches "Hit Points 66", "HP 66 (12d8 + 12)"
    const hpMatch = cleaned.match(/(?:Hit Points|HP)\s*[\n:]?\s*(\d+)/i);
    const hitPoints = hpMatch ? parseInt(hpMatch[1], 10) : 10;

    // Speed
    const speedMatch = cleaned.match(/Speed:?\s*([^\n]+)/i);
    const speed = speedMatch ? speedMatch[1].trim() : '30 ft.';

    // Abilities: Matches vertical tables ("Str\n26\n+8\n+8") as well as horizontal ("STR 26")
    const abilities: Record<string, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    };

    const strMatch = cleaned.match(/\b(?:STR|Strength)\b[\s:]*(\d+)/i);
    if (strMatch) abilities.strength = parseInt(strMatch[1], 10);
    const dexMatch = cleaned.match(/\b(?:DEX|Dexterity)\b[\s:]*(\d+)/i);
    if (dexMatch) abilities.dexterity = parseInt(dexMatch[1], 10);
    const conMatch = cleaned.match(/\b(?:CON|Constitution)\b[\s:]*(\d+)/i);
    if (conMatch) abilities.constitution = parseInt(conMatch[1], 10);
    const intMatch = cleaned.match(/\b(?:INT|Intelligence)\b[\s:]*(\d+)/i);
    if (intMatch) abilities.intelligence = parseInt(intMatch[1], 10);
    const wisMatch = cleaned.match(/\b(?:WIS|Wisdom)\b[\s:]*(\d+)/i);
    if (wisMatch) abilities.wisdom = parseInt(wisMatch[1], 10);
    const chaMatch = cleaned.match(/\b(?:CHA|Charisma)\b[\s:]*(\d+)/i);
    if (chaMatch) abilities.charisma = parseInt(chaMatch[1], 10);

    // Saving Throws
    const savesMatch = cleaned.match(/Saving Throws\s*[\n:]?\s*([^\n]+)/i);
    const savingThrows = savesMatch ? savesMatch[1].split(',').map(s => s.trim()) : [];

    // Skills
    const skillsMatch = cleaned.match(/Skills\s*[\n:]?\s*([^\n]+)/i);
    const skills = skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()) : [];

    // Resistances / Immunities (Supports 2014 & 2024 D&D Beyond formats)
    const resMatch = cleaned.match(/(?:Damage\s+Resistances|Resistances)\s*[\n:]?\s*([^\n;]+)/i);
    const damageResistances = resMatch ? resMatch[1].trim() : '';

    let damageImmunities = '';
    let conditionImmunities = '';

    const dmgImmMatch = cleaned.match(/Damage\s+Immunities\s*[\n:]?\s*([^\n;]+)/i);
    if (dmgImmMatch) damageImmunities = dmgImmMatch[1].trim();

    const condImmMatch = cleaned.match(/Condition\s+Immunities\s*[\n:]?\s*([^\n]+)/i);
    if (condImmMatch) conditionImmunities = condImmMatch[1].trim();

    const unifiedImmMatch = cleaned.match(/(?:^|\n)Immunities\s*[\n:]?\s*([^\n]+)/i);
    if (unifiedImmMatch) {
      const fullImmText = unifiedImmMatch[1].trim();
      if (fullImmText.includes(';')) {
        const parts = fullImmText.split(';').map(p => p.trim());
        damageImmunities = damageImmunities || parts[0];
        conditionImmunities = conditionImmunities || parts[1];
      } else {
        const conditionsList = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
        const items = fullImmText.split(',').map(s => s.trim().toLowerCase());
        const hasCondition = items.some(it => conditionsList.includes(it));
        if (hasCondition) {
          conditionImmunities = conditionImmunities || fullImmText;
        } else {
          damageImmunities = damageImmunities || fullImmText;
        }
      }
    }

    // Senses
    const sensesMatch = cleaned.match(/Senses\s*[\n:]?\s*([^\n]+)/i);
    const senses = sensesMatch ? sensesMatch[1].trim() : 'Passive Perception 10';

    // Languages
    const langMatch = cleaned.match(/Languages\s*[\n:]?\s*([^\n]+)/i);
    const languages = langMatch ? langMatch[1].trim() : '—';

    // Challenge / CR: Matches "Challenge 4", "CR 4", "CR 4 (XP 1,100; PB +2)"
    const crMatch = cleaned.match(/(?:Challenge|CR)\s*[\n:]?\s*(\d+(?:\/\d+)?)/i);
    const challengeRating = crMatch ? crMatch[1] : '1';

    const pbMatch = cleaned.match(/PB\s*\+?(\d+)/i);
    const proficiencyBonus = pbMatch ? parseInt(pbMatch[1], 10) : 2;

    // High precision deterministic section parsing for Traits, Actions, Reactions, Legendary Actions
    const sections = this.parseMonsterSections(cleaned);

    const result: any = {
      ...MONSTER_TEMPLATE,
      name,
      type,
      size,
      alignment,
      armorClass,
      hitPoints,
      speed,
      abilities,
      savingThrows,
      skills,
      damageResistances,
      damageImmunities,
      conditionImmunities,
      senses,
      languages,
      challengeRating,
      proficiencyBonus,
      traits: sections.traits,
      actions: sections.actions,
      bonusActions: sections.bonusActions,
      reactions: sections.reactions,
      legendaryActions: sections.legendaryActions,
      translations: {}
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Deterministic extraction of named monster action/trait sections from raw text
   */
  private parseMonsterSections(text: string): {
    traits: Array<{ name: string; description: string }>;
    actions: Array<{ name: string; description: string }>;
    bonusActions: Array<{ name: string; description: string }>;
    reactions: Array<{ name: string; description: string }>;
    legendaryActions: Array<{ name: string; description: string }>;
  } {
    const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const headerPatterns = [
      { type: 'traits', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Traits|Special\s+Traits):?(?:\*\*)?\s*(?:\n|$)/i },
      { type: 'actions', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Actions?:?(?:\*\*)?\s*(?:\n|$)/i },
      { type: 'bonusActions', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Bonus\s+Actions?:?(?:\*\*)?\s*(?:\n|$)/i },
      { type: 'reactions', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Reactions?:?(?:\*\*)?\s*(?:\n|$)/i },
      { type: 'legendaryActions', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Legendary\s+Actions?:?(?:\*\*)?\s*(?:\n|$)/i }
    ];

    const sectionsFound: Array<{ type: string; start: number; headingIndex: number }> = [];
    for (const hp of headerPatterns) {
      const match = raw.match(hp.regex);
      if (match && match.index !== undefined) {
        sectionsFound.push({
          type: hp.type,
          start: match.index + match[0].length,
          headingIndex: match.index
        });
      }
    }

    sectionsFound.sort((a, b) => a.headingIndex - b.headingIndex);

    const sectionsContent: Record<string, string> = {
      traits: '',
      actions: '',
      bonusActions: '',
      reactions: '',
      legendaryActions: ''
    };

    for (let i = 0; i < sectionsFound.length; i++) {
      const current = sectionsFound[i];
      const nextStart = i + 1 < sectionsFound.length ? sectionsFound[i + 1].headingIndex : raw.length;
      sectionsContent[current.type] = raw.substring(current.start, nextStart).trim();
    }

    // Trait blocks between CR and the first header if no explicit "Traits" heading
    if (!sectionsContent.traits && sectionsFound.length > 0) {
      const firstHeading = sectionsFound[0];
      const crMatch = raw.match(/(?:Challenge|CR)\s*[\n:]?\s*[^\n]+(?:\n|$)/i);
      if (crMatch && crMatch.index !== undefined) {
        const crEnd = crMatch.index + crMatch[0].length;
        if (crEnd < firstHeading.headingIndex) {
          const between = raw.substring(crEnd, firstHeading.headingIndex).trim();
          if (between.length > 0) {
            sectionsContent.traits = between;
          }
        }
      }
    }

    return {
      traits: this.parseEntries(sectionsContent.traits),
      actions: this.parseEntries(sectionsContent.actions),
      bonusActions: this.parseEntries(sectionsContent.bonusActions),
      reactions: this.parseEntries(sectionsContent.reactions),
      legendaryActions: this.parseEntries(sectionsContent.legendaryActions)
    };
  }

  private parseEntries(content: string): Array<{ name: string; description: string }> {
    if (!content) return [];
    const entries: Array<{ name: string; description: string }> = [];
    const lines = content.split('\n');
    let current: { name: string; description: string } | null = null;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Stop parsing if we hit following non-stat block chapters, habitats, tables or quote markers
      if (/^(?:Habitat:|Treasure:|Roll on\s|\d+d\d+\b|Rule\s+\d+:|[—–-]\s*[A-Z])/i.test(line)) {
        break;
      }

      // Skip generic section intros like "The dragon can take 3 legendary actions..." or "Legendary Action Uses: 3"
      if (/^the\s+[a-z0-9\s\-]+can\s+take\s+\d+\s+legendary\s+actions/i.test(line)) {
        continue;
      }
      if (/^legendary\s+action\s+uses:/i.test(line)) {
        continue;
      }

      // Check for markdown heading: ### Title
      const hMatch = line.match(/^###\s+([^\n]+)/);
      if (hMatch) {
        if (current) entries.push(current);
        current = { name: hMatch[1].trim(), description: '' };
        continue;
      }

      // Check for Title. Description or **Title.** Description or Title (Extra). Description
      const titleMatch = line.match(/^(?:\*\*)?([A-Z0-9][A-Za-z0-9',:\s\(\)\/\-–—]+?)(?:\*\*)?\.\s+(.+)$/);
      if (titleMatch) {
        const potentialName = titleMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
        const nameWithoutParens = potentialName.replace(/\([^)]*\)/g, '').trim();
        if (
          potentialName.length <= 60 &&
          !/[,;!?]/.test(nameWithoutParens) &&
          !/^(?:Speed|AC|HP|Ability|Score|Mod|Save|Str|Dex|Con|Int|Wis|Cha|The|Such|These|Those|When|If|After|Failure|Success|Trigger|Response)\b/i.test(potentialName)
        ) {
          if (current) entries.push(current);
          current = {
            name: potentialName,
            description: titleMatch[2].trim()
          };
          continue;
        }
      }

      // Continuation line for current entry
      if (current) {
        current.description = current.description ? current.description + '\n' + line : line;
      }
    }

    if (current) entries.push(current);
    return entries;
  }

  private extractGenericObject(text: string, schema: any, options: NormalizeOptions): string {
    const clone = { ...schema };
    for (const key of Object.keys(clone)) {
      if (typeof clone[key] === 'string' && clone[key].length > 10) {
        clone[key] = text.trim();
        break;
      }
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractSectionalTraits(text: string): string {
    const traits = this.parseEntries(text);
    return JSON.stringify({ traits }, null, 2);
  }

  private extractSectionalActions(text: string): string {
    const sections = this.parseMonsterSections(text);
    if (sections.bonusActions.length > 0 || sections.reactions.length > 0) {
      return JSON.stringify({
        actions: sections.actions,
        bonusActions: sections.bonusActions,
        reactions: sections.reactions
      }, null, 2);
    }
    const actions = this.parseEntries(text);
    return JSON.stringify({ actions }, null, 2);
  }

  private extractSectionalBonusActions(text: string): string {
    const bonusActions = this.parseEntries(text);
    return JSON.stringify({ bonusActions }, null, 2);
  }

  private extractSectionalLegendary(text: string): string {
    const legendaryActions = this.parseEntries(text);
    return JSON.stringify({ legendaryActions }, null, 2);
  }

  private extractSectionalReactions(text: string): string {
    const reactions = this.parseEntries(text);
    return JSON.stringify({ reactions }, null, 2);
  }
}
