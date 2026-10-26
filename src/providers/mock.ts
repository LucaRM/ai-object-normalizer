import { PropertyValidator } from '../pipeline/validator';
import { NormalizerProvider, NormalizeOptions } from '../types';
import { MONSTER_TEMPLATE } from '../templates/monster';
import { WEAPON_TEMPLATE } from '../templates/weapon';
import { SPELL_TEMPLATE } from '../templates/spell';
import { MAGICAL_ITEM_TEMPLATE } from '../templates/magicalItem';
import { SPECIES_TEMPLATE } from '../templates/species';
import { BACKGROUND_TEMPLATE } from '../templates/background';
import { FEAT_TEMPLATE } from '../templates/feat';
import { CLASS_TEMPLATE } from '../templates/class';
import { SUBCLASS_TEMPLATE } from '../templates/subclass';
import { ARMOR_TEMPLATE } from '../templates/armor';
import { ITEM_TEMPLATE } from '../templates/item';
import { MonsterStatExtractor } from '../pipeline/monsterExtractor';
import { MonsterActionParser } from '../pipeline/actionParser';

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

  async normalize(text: string, schema: any, options: NormalizeOptions = {}): Promise<string> {
    const tmpl = (options?.template || '').toLowerCase().trim();

    // If template is explicitly specified, route directly to it first
    if (tmpl === 'monster') return this.extractMonsterStatBlock(text, schema, options);
    if (tmpl === 'species' || tmpl === 'race') return this.extractSpecies(text, schema, options);
    if (tmpl === 'background') return this.extractBackground(text, schema, options);
    if (tmpl === 'feat') return this.extractFeat(text, schema, options);
    if (tmpl === 'spell') return this.extractSpell(text, schema, options);
    if (tmpl === 'magical-item' || tmpl === 'magicalitem' || tmpl === 'magicitem' || tmpl === 'magic-item') {
      return this.extractMagicalItem(text, schema, options);
    }
    if (tmpl === 'weapon') return this.extractWeapon(text, schema, options);
    if (tmpl === 'armor' || tmpl === 'armour' || tmpl === 'shield') return this.extractArmor(text, schema, options);
    if (tmpl === 'item' || tmpl === 'equipment' || tmpl === 'gear') return this.extractItem(text, schema, options);
    if (tmpl === 'class') return this.extractClass(text, schema, options);
    if (tmpl === 'subclass') return this.extractSubclass(text, schema, options);

    // Sectional sub-schemas (chunked monster extraction) - only when template is unspecified or monster
    const isMonsterSubSchema = !tmpl || tmpl === 'monster' || tmpl === 'auto';
    if (isMonsterSubSchema && schema && Array.isArray(schema.traits) && schema.armorClass === undefined && !schema.name) {
      return this.extractSectionalTraits(text);
    }
    if (isMonsterSubSchema && schema && Array.isArray(schema.reactions) && schema.actions === undefined && schema.armorClass === undefined) {
      return this.extractSectionalReactions(text);
    }
    if (isMonsterSubSchema && schema && Array.isArray(schema.bonusActions) && schema.actions === undefined && schema.armorClass === undefined) {
      return this.extractSectionalBonusActions(text);
    }
    if (isMonsterSubSchema && schema && (Array.isArray(schema.actions) || Array.isArray(schema.reactions)) && schema.armorClass === undefined) {
      return this.extractSectionalActions(text);
    }
    if (isMonsterSubSchema && schema && Array.isArray(schema.legendaryActions) && schema.armorClass === undefined) {
      return this.extractSectionalLegendary(text);
    }

    // Heuristic template detection when template is not provided or set to 'auto'
    // 1. Monster
    if (
      /\b(?:armor\s+class|ac)\s*[\n:]?\s*\d+/i.test(text) &&
      /\b(?:hit\s+points|hp)\s*[\n:]?\s*\d+/i.test(text)
    ) {
      return this.extractMonsterStatBlock(text, schema, options);
    }

    // 2. Species / Race
    if (
      /Creature\s+Type\s*:/i.test(text) ||
      /\b(?:Speed:\s*\d+\s*feet|Darkvision|Dwarven\s+Resilience|Fey\s+Ancestry)\b/i.test(text)
    ) {
      return this.extractSpecies(text, schema, options);
    }

    // 3. Background
    if (
      /Ability\s+Scores?:\s*[^\n]+\n\s*Feat:/i.test(text) ||
      /Skill\s+Proficienc(?:y|ies):/i.test(text) ||
      /Tool\s+Proficienc(?:y|ies):/i.test(text)
    ) {
      return this.extractBackground(text, schema, options);
    }

    // 4. Feat
    if (
      /^(?:Origin|General|Fighting\s+Style|Epic\s+Boon)\s+Feat/mi.test(text) ||
      /Prerequisite:\s*[^\n]+/i.test(text)
    ) {
      return this.extractFeat(text, schema, options);
    }

    // 5. Magical Item (checked before spell to catch items with charges casting spells)
    if (
      /^(?:Wondrous\s+Item|Armor|Weapon|Ring|Rod|Scroll|Staff|Wand|Potion)\s*,/mi.test(text) ||
      /\b(?:wondrous\s+item|requires attunement)\b/i.test(text)
    ) {
      return this.extractMagicalItem(text, schema, options);
    }

    // 6. Subclass (checked before spell to prevent subclass archetype text from falling into spell parser)
    if (
      /\b(?:Subclass|Archetype)\b/i.test(text) &&
      /\b(?:Fighter|Barbarian|Wizard|Rogue|Cleric|Paladin|Druid|Bard|Monk|Ranger|Sorcerer|Warlock)\b/i.test(text)
    ) {
      return this.extractSubclass(text, schema, options);
    }

    // 7. Class
    if (
      /\b(?:Hit Point Die|Primary Ability|Core\s+[A-Za-z]+\s+Traits)\b/i.test(text) ||
      (/\bSaving\s+Throw\s+Proficienc(?:y|ies)\b/i.test(text) && /\bHit\s+(?:Point\s+)?Die\b/i.test(text))
    ) {
      return this.extractClass(text, schema, options);
    }

    // 8. Spell
    if (
      /\b(?:Casting Time|Truque|Cantrip)\b/i.test(text) ||
      /\b(?:\d+(?:st|nd|rd|th)?[- ]level\s+(?:evocation|abjuration|conjuration|divination|enchantment|illusion|necromancy|transmutation))\b/i.test(text)
    ) {
      return this.extractSpell(text, schema, options);
    }

    // 9. Weapon
    if (text.toLowerCase().includes('versatile') || text.toLowerCase().includes('mastery:')) {
      return this.extractWeapon(text, schema, options);
    }

    // Generic heuristic normalization
    return this.extractGenericObject(text, schema, options);
  }

  private cleanName(raw: string): string {
    if (!raw) return '';
    return raw
      .replace(/^#+\s*/, '')
      .replace(/^[*_]{1,3}|[*_]{1,3}$/g, '')
      .replace(/^[—–-]\s*/, '')
      .trim();
  }

  private extractSpecies(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const rawFirstLine = this.cleanName(lines[0] || 'Unknown Species');
    const name = rawFirstLine.replace(/\s+Traits?$/i, '').trim();

    // 1. Creature Type
    const cTypeMatch = cleaned.match(/Creature\s+Type\s*:\s*([^\n]+)/i);
    const creatureType = cTypeMatch ? cTypeMatch[1].trim() : 'Humanoid';

    // 2. Size
    const sizeMatch = cleaned.match(/Size\s*:\s*([^\n]+)/i);
    let size = 'Medium';
    if (sizeMatch) {
      const rawSize = sizeMatch[1].split('(')[0].trim();
      const sMatch = rawSize.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i);
      size = sMatch ? (sMatch[1][0].toUpperCase() + sMatch[1].slice(1).toLowerCase()) : rawSize;
    }

    // 3. Speed
    const speedMatch = cleaned.match(/Speed\s*:\s*(\d+)\s*(?:feet|ft)/i);
    const baseSpeed = speedMatch ? parseInt(speedMatch[1], 10) : 30;
    const speed = baseSpeed;

    // 4. Languages
    const langMatch = cleaned.match(/Languages?\s*:\s*([^\n]+)/i);
    const baseLanguages = langMatch
      ? langMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      : ['Common'];

    // 5. Features & Description
    const bodyLines = lines.slice(1).filter(l => {
      if (/^(?:Creature\s+Type|Size|Speed|Languages?)\s*:/i.test(l)) return false;
      if (/^(?:Traits|Species\s+Traits|Special\s+Traits):?$/i.test(l)) return false;
      return true;
    });
    const bodyText = bodyLines.join('\n');

    let entries = this.parseEntries(bodyText);

    // Fallback: If no structured entries found via parseEntries, check for comma-separated or listed trait names
    if (entries.length === 0 && bodyLines.length > 0) {
      const commaTraits = bodyLines[0].split(',').map(t => t.trim()).filter(Boolean);
      if (commaTraits.length > 1) {
        entries = commaTraits.map(t => ({
          name: t.replace(/\.+$/, '').trim(),
          description: `Trait granted by the ${name} species.`
        }));
      }
    }

    const features = entries.map(e => {
      return PropertyValidator.enrichSpeciesFeature({
        name: e.name,
        description: e.description
      });
    });

    const clone: any = {
      ...SPECIES_TEMPLATE,
      name,
      description: `Members of the ${name} species.`,
      creatureType,
      size,
      baseSpeed,
      speed,
      baseLanguages,
      features,
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractBackground(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const rawName = this.cleanName(lines[0] || 'Unknown Background');
    const name = rawName.replace(/^Background\s*:\s*/i, '');

    // 1. Ability Scores
    const abilityMatch = cleaned.match(/Ability\s+Scores?\s*:\s*([^\n]+)/i);
    const abilityScoreIncrease = abilityMatch
      ? abilityMatch[1].split(/,|\band\b|\//i).map(s => s.trim()).filter(Boolean)
      : ['Strength', 'Dexterity', 'Constitution'];

    // 2. Feat
    const featMatch = cleaned.match(/Feat\s*:\s*([^\n]+)/i);
    const feat = featMatch ? featMatch[1].trim() : 'Savage Attacker';

    // 3. Skill Proficiencies
    const skillMatch = cleaned.match(/Skill\s+Proficienc(?:y|ies)\s*:\s*([^\n]+)/i);
    const skillProficiency = skillMatch
      ? skillMatch[1].split(/,|\band\b/i).map(s => s.trim()).filter(Boolean)
      : [];

    // 4. Tool Proficiency
    const toolMatch = cleaned.match(/Tool\s+Proficienc(?:y|ies)\s*:\s*([^\n]+)/i);
    const toolProficiency = toolMatch
      ? toolMatch[1].split(/,|\band\b/i).map(s => s.trim()).filter(Boolean)
      : [];

    // 5. Equipment
    const equipMatch = cleaned.match(/Equipment\s*:\s*([^\n]+(?:\n(?!\n|[A-Z][a-zA-Z\s]+:).*)*)/i);
    let equipment: any[] = [];
    if (equipMatch) {
      const equipText = equipMatch[1].trim();
      const optionAMatch = equipText.match(/\(A\)\s*([^;]+)/i);
      const optionBMatch = equipText.match(/\(B\)\s*([^;\n]+)/i);

      if (optionAMatch || optionBMatch) {
        if (optionAMatch) {
          const itemsA = optionAMatch[1].split(',').map(i => {
            const trimmed = i.trim();
            const qtyMatch = trimmed.match(/^(\d+)\s+(.+)$/);
            return qtyMatch
              ? { name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1], 10) }
              : { name: trimmed, quantity: 1 };
          }).filter(i => i.name.length > 0);

          equipment.push({
            id: 'eq-opt-a',
            name: `${name} Starting Gear (Option A)`,
            description: optionAMatch[1].trim(),
            items: itemsA
          });
        }
        if (optionBMatch) {
          equipment.push({
            id: 'eq-opt-b',
            name: `${name} Starting Gear (Option B)`,
            description: optionBMatch[1].trim(),
            items: [{ name: optionBMatch[1].trim(), quantity: 1 }]
          });
        }
      } else {
        const items = equipText.split(',').map(i => {
          const trimmed = i.trim();
          const qtyMatch = trimmed.match(/^(\d+)\s+(.+)$/);
          return qtyMatch
            ? { name: qtyMatch[2].trim(), quantity: parseInt(qtyMatch[1], 10) }
            : { name: trimmed, quantity: 1 };
        }).filter(i => i.name.length > 0);

        equipment.push({
          id: 'eq-starting',
          name: `${name} Starting Equipment`,
          description: equipText,
          items
        });
      }
    }

    // 6. Description & Features
    const bodyLines = lines.slice(1).filter(l => {
      if (/^(?:Ability\s+Scores?|Feat|Skill\s+Proficienc(?:y|ies)?|Tool\s+Proficienc(?:y|ies)?|Equipment|Source)\s*:/i.test(l)) return false;
      return true;
    });
    const bodyText = bodyLines.join('\n\n').trim();

    const entries = this.parseEntries(bodyText);
    const features = entries.map(e => ({
      name: e.name,
      description: e.description,
      category: 'Social'
    }));

    const clone: any = {
      ...BACKGROUND_TEMPLATE,
      name,
      description: bodyText || `You have lived your life as a ${name}.`,
      feat,
      abilityScoreIncrease,
      skillProficiency,
      toolProficiency,
      equipment,
      features,
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractFeat(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const rawName = this.cleanName(lines[0] || 'Unknown Feat');
    const name = rawName;

    // 1. Category (featType): Origin, General, Fighting Style, Epic Boon
    let featType = 'General';
    const catMatch = cleaned.match(/(?:^|\n)\s*(Origin|General|Fighting\s+Style|Epic\s+Boon)(?:\s+Feat)?\b/i);
    if (catMatch) {
      const rawCat = catMatch[1].toLowerCase().replace(/\s+/g, ' ');
      if (rawCat === 'origin') featType = 'Origin';
      else if (rawCat === 'general') featType = 'General';
      else if (rawCat === 'fighting style') featType = 'Fighting Style';
      else if (rawCat === 'epic boon') featType = 'Epic Boon';
    }

    // 2. Prerequisite
    const prereqMatch = cleaned.match(/Prerequisite\s*:\s*([^)\n]+)/i);
    const prerequisite = prereqMatch ? prereqMatch[1].trim() : 'None';

    // 3. Repeatable
    const repeatable = /\b(?:repeatable|can be taken more than once|take this feat multiple times)\b/i.test(cleaned);

    // 4. Ability Score Increase
    let abilityScoreIncrease: any = undefined;
    const asiMatch = cleaned.match(/Increase your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score by (\d+)/i);
    if (asiMatch) {
      abilityScoreIncrease = {
        abilities: [asiMatch[1]],
        amount: parseInt(asiMatch[2], 10),
        choice: false
      };
    }

    // 5. Filter header lines to isolate body
    const bodyLines = lines.slice(1).filter(l => {
      if (/^(?:Origin|General|Fighting\s+Style|Epic\s+Boon)(?:\s+Feat)?(?:\s*\([^)]*\))?$/i.test(l)) return false;
      if (/^Prerequisite\s*:/i.test(l)) return false;
      return true;
    });
    const bodyText = bodyLines.join('\n');

    // 6. Sub-features
    const entries = this.parseEntries(bodyText);
    let features: any[] = [];
    let description = bodyText.trim();

    if (entries.length > 0) {
      features = entries.map(e => ({
        name: e.name,
        description: e.description,
        category: /attack|hit|damage|weapon|combat|critical/i.test(e.name + ' ' + e.description) ? 'Combat' : 'Passive'
      }));
      const firstEntryName = entries[0].name;
      const idx = bodyText.indexOf(firstEntryName);
      const intro = idx > 0 ? bodyText.substring(0, idx).trim() : '';
      if (intro.length > 0) {
        description = intro;
      } else {
        const featureNames = features.map(f => f.name).filter(Boolean);
        description = featureNames.length > 0
          ? `You gain the following benefits: ${featureNames.join(', ')}.`
          : 'You gain the following benefits:';
      }
    } else {
      features = [
        {
          name,
          description: bodyText.trim(),
          category: 'Passive'
        }
      ];
    }

    const clone: any = {
      ...FEAT_TEMPLATE,
      name,
      description: description || 'You gain the following benefits:',
      featType,
      prerequisite,
      repeatable,
      ...(abilityScoreIncrease && { abilityScoreIncrease }),
      features,
      translations: {}
    };
    if (!abilityScoreIncrease) {
      delete clone.abilityScoreIncrease;
    }
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractSpell(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const rawName = this.cleanName(lines[0] || 'Unknown Spell');
    const name = rawName;

    // 1. Level
    let level = 1;
    if (/(?:Cantrip|Truque)/i.test(cleaned)) {
      level = 0;
    } else {
      const lvlMatch = cleaned.match(/(\d+)(?:st|nd|rd|th)?[- ]Level/i) || cleaned.match(/Level\s+(\d+)/i);
      if (lvlMatch) {
        level = parseInt(lvlMatch[1], 10);
      } else {
        const ordMatch = cleaned.match(/\b(1st|2nd|3rd|[4-9]th)[- ]level\b/i);
        if (ordMatch) {
          const ordMap: Record<string, number> = {
            '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5,
            '6th': 6, '7th': 7, '8th': 8, '9th': 9
          };
          level = ordMap[ordMatch[1].toLowerCase()] || 1;
        }
      }
    }

    // 2. School
    const schoolMatch = cleaned.match(/\b(Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation)\b/i);
    const school = schoolMatch
      ? (schoolMatch[1][0].toUpperCase() + schoolMatch[1].slice(1).toLowerCase())
      : 'Evocation';

    // 3. Classes
    let classes: string[] = [];
    const classesLineMatch = cleaned.match(/(?:^|\n)\s*Classes\s*:\s*([^\n]+)/i);
    if (classesLineMatch) {
      classes = classesLineMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const headerClassesMatch = cleaned.match(/\(([^)]*(?:Sorcerer|Wizard|Cleric|Druid|Bard|Paladin|Ranger|Warlock|Artificer)[^)]*)\)/i);
      if (headerClassesMatch) {
        classes = headerClassesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // 4. Casting Time & Action
    const castingTimeMatch = cleaned.match(/Casting\s+Time\s*:\s*([^\n]+)/i);
    const castingTime = castingTimeMatch ? castingTimeMatch[1].trim() : '1 Action';
    let castingAction = 'Action';
    if (/bonus\s+action/i.test(castingTime)) {
      castingAction = 'Bonus Action';
    } else if (/reaction/i.test(castingTime)) {
      castingAction = 'Reaction';
    } else if (/minute|hour/i.test(castingTime)) {
      castingAction = 'Special';
    }

    // 5. Range, Components, Duration
    const rangeMatch = cleaned.match(/Range\s*:\s*([^\n]+)/i);
    const range = rangeMatch ? rangeMatch[1].trim() : 'Self';

    const componentsMatch = cleaned.match(/Components\s*:\s*([^\n]+)/i);
    const compRaw = componentsMatch ? componentsMatch[1].trim() : 'V, S';
    const verbal = /\bV\b/i.test(compRaw) || /\bverbal\b/i.test(compRaw);
    const somatic = /\bS\b/i.test(compRaw) || /\bsomatic\b/i.test(compRaw);
    const material = /\bM\b/i.test(compRaw) || /\bmaterial\b/i.test(compRaw);
    const matDescMatch = compRaw.match(/\(([^)]+)\)/);
    const materialsDescription = matDescMatch ? matDescMatch[1].trim() : undefined;

    const components: { verbal: boolean; somatic: boolean; material: boolean; materialsDescription?: string } = {
      verbal,
      somatic,
      material,
      ...(materialsDescription && { materialsDescription })
    };

    const durationMatch = cleaned.match(/Duration\s*:\s*([^\n]+)/i);
    const duration = durationMatch ? durationMatch[1].trim() : 'Instantaneous';

    // 6. Ritual & Concentration
    const ritual = /\b(?:ritual|tag:\s*ritual)\b/i.test(cleaned);
    const concentration = /\bconcentration\b/i.test(cleaned) || /concentration,\s*up to/i.test(duration);

    // 7. Damage Type
    const dmgMatch = cleaned.match(/\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage\b/i);
    const damageType = dmgMatch ? dmgMatch[1].toLowerCase() : null;

    // 8. At Higher Levels
    let atHigherLevels: string | undefined = undefined;
    const higherMatch = cleaned.match(/(?:At\s+Higher\s+Levels|Using\s+a\s+Higher[- ]Level\s+Slot)[.:]?\s*([^\n]+(?:\n(?!\n|[A-Z][a-zA-Z\s]+:).*)*)/i);
    if (higherMatch) {
      atHigherLevels = higherMatch[1].trim();
    }

    // 9. Description: strip classification lines, metadata headers, and atHigherLevels
    const isClassificationLine = (l: string) => {
      const trimmed = l.trim();
      return (
        /^(?:(?:[1-9](?:st|nd|rd|th)?[- ]level\s+)?(?:abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)(?:\s+cantrip)?|cantrip)(?:\s*\([^)]*\))?$/i.test(trimmed) ||
        /^(?:evocation|abjuration|conjuration|divination|enchantment|illusion|necromancy|transmutation)\s+(?:cantrip|truque)(?:\s*\([^)]*\))?$/i.test(trimmed) ||
        /^(?:cantrip|truque)\s+(?:evocation|abjuration|conjuration|divination|enchantment|illusion|necromancy|transmutation)(?:\s*\([^)]*\))?$/i.test(trimmed)
      );
    };

    const descLines = lines.slice(1).filter(l => {
      if (isClassificationLine(l)) return false;
      if (/^(?:casting\s+time|range|components|duration|classes)\s*:/i.test(l)) return false;
      if (/^(?:At\s+Higher\s+Levels|Using\s+a\s+Higher[- ]Level\s+Slot)[.:]?/i.test(l)) return false;
      return true;
    });

    const description = descLines.join('\n\n') || cleaned.trim();

    const clone: any = {
      ...SPELL_TEMPLATE,
      name,
      level,
      school,
      castingAction,
      castingTime,
      range,
      components,
      duration,
      ritual,
      concentration,
      damageType,
      classes,
      description,
      translations: {}
    };

    if (atHigherLevels) {
      clone.atHigherLevels = atHigherLevels;
    } else {
      delete clone.atHigherLevels;
    }
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractMagicalItem(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const rawName = this.cleanName(lines[0] || 'Unknown Magical Item');
    const name = rawName;

    // 1. Entity Type & Rarity
    let entityType = 'wondrous';
    let rarity = 'uncommon';

    const typeRarityMatch = cleaned.match(
      /(?:^|\n)\s*(Wondrous\s+Item|Armor|Weapon|Ring|Rod|Scroll|Staff|Wand|Potion)(?:\s*\([^)]*\))?\s*,\s*(Common|Uncommon|Rare|Very\s+Rare|Legendary|Artifact)/i
    );

    if (typeRarityMatch) {
      const rawType = typeRarityMatch[1].toLowerCase().trim();
      if (rawType.includes('wondrous')) entityType = 'wondrous';
      else if (rawType.includes('armor')) entityType = 'armor';
      else if (rawType.includes('weapon')) entityType = 'weapon';
      else if (rawType.includes('ring')) entityType = 'ring';
      else if (rawType.includes('rod')) entityType = 'rod';
      else if (rawType.includes('scroll')) entityType = 'scroll';
      else if (rawType.includes('staff')) entityType = 'staff';
      else if (rawType.includes('wand')) entityType = 'wand';
      else if (rawType.includes('potion')) entityType = 'potion';

      rarity = typeRarityMatch[2].toLowerCase().trim();
    } else {
      const eTypeMatch = cleaned.match(/\b(Wondrous\s+Item|Armor|Weapon|Ring|Rod|Scroll|Staff|Wand|Potion)\b/i);
      if (eTypeMatch) {
        const rawType = eTypeMatch[1].toLowerCase();
        if (rawType.includes('wondrous')) entityType = 'wondrous';
        else if (rawType.includes('armor')) entityType = 'armor';
        else if (rawType.includes('weapon')) entityType = 'weapon';
        else if (rawType.includes('ring')) entityType = 'ring';
        else if (rawType.includes('rod')) entityType = 'rod';
        else if (rawType.includes('scroll')) entityType = 'scroll';
        else if (rawType.includes('staff')) entityType = 'staff';
        else if (rawType.includes('wand')) entityType = 'wand';
        else if (rawType.includes('potion')) entityType = 'potion';
      }
      const rarityMatch = cleaned.match(/\b(Common|Uncommon|Rare|Very\s+Rare|Legendary|Artifact)\b/i);
      if (rarityMatch) {
        rarity = rarityMatch[1].toLowerCase().trim();
      }
    }

    // 2. Attunement
    const requiresAttunement = /\(requires attunement(?:\s+by\s+[^)]+)?\)/i.test(cleaned);

    // 3. Attack & Damage Bonuses (Weapons)
    let magicBonusToHit = 0;
    let magicBonusToDamage = 0;
    const plusBonusMatch =
      cleaned.match(/\+(\d+)\s+bonus\s+to\s+attack\s+rolls\s+and\s+damage\s+rolls/i) ||
      cleaned.match(/(?:gain\s+a\s+|have\s+a\s+|\+)(\d+)\s+bonus\s+to\s+attack(?:\s+rolls)?\s+and\s+damage\s+rolls/i) ||
      cleaned.match(/\+(\d+)\s+bonus\s+to\s+attack(?:\s+rolls)?\s+and\s+damage\s+rolls/i) ||
      cleaned.match(/,\s*\+(\d+)\b/i) ||
      cleaned.match(/\+(\d+)\s+weapon\b/i);
    if (plusBonusMatch) {
      magicBonusToHit = parseInt(plusBonusMatch[1], 10);
      magicBonusToDamage = parseInt(plusBonusMatch[1], 10);
    } else {
      const hitMatch = cleaned.match(/\+(\d+)\s+bonus\s+to\s+attack(?:\s+rolls)?/i);
      const dmgMatch = cleaned.match(/\+(\d+)\s+bonus\s+to\s+damage(?:\s+rolls)?/i);
      if (hitMatch) magicBonusToHit = parseInt(hitMatch[1], 10);
      if (dmgMatch) magicBonusToDamage = parseInt(dmgMatch[1], 10);
      if (!hitMatch && !dmgMatch) {
        const namePlus = name.match(/\+(\d+)\b/);
        if (namePlus) {
          magicBonusToHit = parseInt(namePlus[1], 10);
          magicBonusToDamage = parseInt(namePlus[1], 10);
        }
      }
    }

    let extraDamage: string | null = null;
    let extraDamageType: string | null = null;
    const extraDmgMatch = cleaned.match(/(?:deals?\s+(?:an\s+)?extra\s+(\d+d\d+)\s+([a-zA-Z]+)\s+damage|extra\s+(\d+d\d+)\s+([a-zA-Z]+)\s+damage|\+(\d+d\d+)\s+([a-zA-Z]+)\s+damage)/i);
    if (extraDmgMatch) {
      extraDamage = extraDmgMatch[1] || extraDmgMatch[3] || extraDmgMatch[5];
      extraDamageType = (extraDmgMatch[2] || extraDmgMatch[4] || extraDmgMatch[6]).toLowerCase();
    }

    // 4. Armor Class & Protection Bonuses
    let armorClassBonus = 0;
    const acBonusMatch = cleaned.match(/(?:gain\s+a\s+|have\s+a\s+|\+)([1-3])\s+bonus\s+to\s+AC\b/i) ||
      cleaned.match(/\+([1-3])\s+(?:Armor|Shield)\b/i) ||
      (/(?:Shield|Armor),\s*\+([1-3])\b/i.exec(name));
    if (acBonusMatch) {
      armorClassBonus = parseInt(acBonusMatch[1], 10);
    }

    let savingThrowBonus = 0;
    const saveBonusMatch = cleaned.match(/(?:gain\s+a\s+|have\s+a\s+|\+)([1-3])\s+bonus\s+to\s+(?:AC\s+and\s+)?(?:all\s+)?saving\s+throws\b/i) ||
      cleaned.match(/\+([1-3])\s+bonus\s+to\s+(?:all\s+)?saving\s+throws/i) ||
      cleaned.match(/\+([1-3])\s+to\s+saving\s+throws/i);
    if (saveBonusMatch) {
      savingThrowBonus = parseInt(saveBonusMatch[1], 10);
    }

    // 5. Spells Granted
    let spells: string[] = [];
    const spellsLineMatch = cleaned.match(/(?:^|\n)\s*Spells?\s*:\s*([^\n]+)/i);
    if (spellsLineMatch) {
      spells = spellsLineMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    } else {
      const castMatch = cleaned.match(/cast\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s+spell\b/i) ||
        cleaned.match(/cast\s+([A-Z][a-zA-Z\s]+?)\s+(?:\(|from\s+it|from\s+the\s+item)/i);
      if (castMatch) {
        spells = [castMatch[1].trim()];
      } else if (/Wand\s+of\s+([A-Z][a-zA-Z\s]+)/i.test(name)) {
        const wandMatch = name.match(/Wand\s+of\s+([A-Z][a-zA-Z\s]+)/i);
        if (wandMatch) spells = [wandMatch[1].trim()];
      } else if (/Scroll\s+of\s+([A-Z][a-zA-Z\s]+)/i.test(name)) {
        const scrollMatch = name.match(/Scroll\s+of\s+([A-Z][a-zA-Z\s]+)/i);
        if (scrollMatch) spells = [scrollMatch[1].trim()];
      } else if (/Ring\s+of\s+(Invisibility|Telekinesis|Shooting\s+Stars|Animal\s+Friendship)/i.test(name)) {
        const ringMatch = name.match(/Ring\s+of\s+([A-Z][a-zA-Z\s]+)/i);
        if (ringMatch) spells = [ringMatch[1].trim()];
      }
    }

    // 6. Description & Features
    const descLines = lines.slice(1).filter(l => {
      if (/^(?:wondrous\s+item|armor|weapon|ring|rod|scroll|staff|wand|potion)/i.test(l)) return false;
      return true;
    });
    const bodyText = descLines.join('\n\n').trim();

    const validAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const parseFeatureDetails = (f: { name: string; description: string; type?: string }) => {
      const fullText = `${f.name || ''} ${f.description || ''}`;
      let actionType: string | null = null;
      if (/\b(?:bonus\s+action)\b/i.test(fullText)) {
        actionType = 'bonus action';
      } else if (/\b(?:reaction)\b/i.test(fullText)) {
        actionType = 'reaction';
      } else if (/\b(?:magic\s+action|action\s+to|as\s+an\s+action|use\s+an\s+action|take\s+an\s+action)\b/i.test(fullText)) {
        actionType = 'action';
      }

      const dcMatch = fullText.match(/\bDC\s*(\d+)\b/i);
      const saveDC = dcMatch ? parseInt(dcMatch[1], 10) : null;

      const abMatch = fullText.match(/\b(?:DC\s*\d+\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\s+(?:saving\s+throw|save)\b/i);
      let saveAbility: string | null = null;
      if (abMatch) {
        const abLower = abMatch[1].toLowerCase();
        saveAbility = validAbilities.find(a => a.startsWith(abLower.slice(0, 3))) || null;
      }

      return {
        ...f,
        type: f.type || (actionType ? 'active' : 'passive'),
        actionType,
        saveDC,
        saveAbility
      };
    };

    const entries = this.parseEntries(bodyText);
    let features = entries.map(e => parseFeatureDetails({
      name: e.name,
      description: e.description,
      type: 'active'
    }));

    if (features.length === 0 && bodyText.length > 0) {
      const hasAction = /(?:use an action|action to|as an action|bonus action)\b/i.test(bodyText);
      const featureName = /Produce\s+Liquid/i.test(bodyText) || /action to name one of the liquids/i.test(bodyText)
        ? 'Produce Liquid'
        : name;

      features.push(parseFeatureDetails({
        name: featureName,
        description: bodyText.trim(),
        type: hasAction ? 'active' : 'passive'
      }));
    }

    // 7. Charges
    let maxCharges = 0;
    const chargeMatch = cleaned.match(/(?:has|contains|with)\s+(\d+)\s+charges\b/i) || cleaned.match(/\b(\d+)\s+charges\b/i);
    if (chargeMatch) {
      maxCharges = parseInt(chargeMatch[1], 10);
    }

    let chargeResetOn = 'Never';
    if (/\bdawn\b/i.test(cleaned)) chargeResetOn = 'Dawn';
    else if (/\bdusk\b/i.test(cleaned)) chargeResetOn = 'Dusk';
    else if (/\blong\s+rest\b/i.test(cleaned)) chargeResetOn = 'Long Rest';
    else if (/\bshort\s+rest\b/i.test(cleaned)) chargeResetOn = 'Short Rest';

    let chargeRegeneration: string | null = null;
    const regenMatch = cleaned.match(/(?:regains?|regaining)\s+([^\n.]+?(?:dawn|dusk|long\s+rest|short\s+rest))/i) ||
      cleaned.match(/([0-9d+\-\s]+expended charges\s+daily\s+at\s+dawn)/i);
    if (regenMatch) {
      chargeRegeneration = regenMatch[1].trim();
    }

    features = features.map(f => {
      let fName = f.name;
      if (/^This\s+(?:wand|item|rod|staff|weapon)\s+has\s+\d+\s+charges/i.test(fName)) {
        fName = spells.length > 0 ? `Cast ${spells[0]}` : `${name} Effect`;
      }
      return {
        ...f,
        name: fName
      };
    });

    const clone: any = {
      ...MAGICAL_ITEM_TEMPLATE,
      name,
      description: bodyText || cleaned.trim(),
      entityType,
      type: 'magic-item',
      rarity,
      requiresAttunement,
      magicBonusToHit,
      magicBonusToDamage,
      extraDamage,
      extraDamageType,
      armorClassBonus,
      savingThrowBonus,
      spells,
      features,
      maxCharges,
      chargeResetOn,
      chargeRegeneration,
      translations: {}
    };

    // If not a weapon, remove weapon mock properties
    if (entityType !== 'weapon') {
      delete clone.baseItem;
      delete clone.baseItemType;
      delete clone.weaponType;
      delete clone.damage;
      delete clone.damageType;
      delete clone.properties;
    } else {
      const WEAPON_DEFS: Record<string, { baseItem: string; weaponType: string; damage: string; damageType: string; properties: string[] }> = {
        dagger: { baseItem: 'Dagger', weaponType: 'Simple Melee', damage: '1d4', damageType: 'piercing', properties: ['Finesse', 'Light', 'Thrown'] },
        dart: { baseItem: 'Dart', weaponType: 'Simple Ranged', damage: '1d4', damageType: 'piercing', properties: ['Finesse', 'Thrown'] },
        sling: { baseItem: 'Sling', weaponType: 'Simple Ranged', damage: '1d4', damageType: 'bludgeoning', properties: ['Ammunition'] },
        shortsword: { baseItem: 'Shortsword', weaponType: 'Martial Melee', damage: '1d6', damageType: 'piercing', properties: ['Finesse', 'Light'] },
        scimitar: { baseItem: 'Scimitar', weaponType: 'Martial Melee', damage: '1d6', damageType: 'slashing', properties: ['Finesse', 'Light'] },
        handaxe: { baseItem: 'Handaxe', weaponType: 'Simple Melee', damage: '1d6', damageType: 'slashing', properties: ['Light', 'Thrown'] },
        javelin: { baseItem: 'Javelin', weaponType: 'Simple Melee', damage: '1d6', damageType: 'piercing', properties: ['Thrown'] },
        spear: { baseItem: 'Spear', weaponType: 'Simple Melee', damage: '1d6', damageType: 'piercing', properties: ['Thrown', 'Versatile'] },
        mace: { baseItem: 'Mace', weaponType: 'Simple Melee', damage: '1d6', damageType: 'bludgeoning', properties: [] },
        quarterstaff: { baseItem: 'Quarterstaff', weaponType: 'Simple Melee', damage: '1d6', damageType: 'bludgeoning', properties: ['Versatile'] },
        longsword: { baseItem: 'Longsword', weaponType: 'Martial Melee', damage: '1d8', damageType: 'slashing', properties: ['Versatile'] },
        battleaxe: { baseItem: 'Battleaxe', weaponType: 'Martial Melee', damage: '1d8', damageType: 'slashing', properties: ['Versatile'] },
        warhammer: { baseItem: 'Warhammer', weaponType: 'Martial Melee', damage: '1d8', damageType: 'bludgeoning', properties: ['Versatile'] },
        rapier: { baseItem: 'Rapier', weaponType: 'Martial Melee', damage: '1d8', damageType: 'piercing', properties: ['Finesse'] },
        flail: { baseItem: 'Flail', weaponType: 'Martial Melee', damage: '1d8', damageType: 'bludgeoning', properties: [] },
        morningstar: { baseItem: 'Morningstar', weaponType: 'Martial Melee', damage: '1d8', damageType: 'piercing', properties: [] },
        greatsword: { baseItem: 'Greatsword', weaponType: 'Martial Melee', damage: '2d6', damageType: 'slashing', properties: ['Heavy', 'Two-Handed'] },
        greataxe: { baseItem: 'Greataxe', weaponType: 'Martial Melee', damage: '1d12', damageType: 'slashing', properties: ['Heavy', 'Two-Handed'] },
        maul: { baseItem: 'Maul', weaponType: 'Martial Melee', damage: '2d6', damageType: 'bludgeoning', properties: ['Heavy', 'Two-Handed'] },
        halberd: { baseItem: 'Halberd', weaponType: 'Martial Melee', damage: '1d10', damageType: 'slashing', properties: ['Heavy', 'Reach', 'Two-Handed'] },
        glaive: { baseItem: 'Glaive', weaponType: 'Martial Melee', damage: '1d10', damageType: 'slashing', properties: ['Heavy', 'Reach', 'Two-Handed'] },
        pike: { baseItem: 'Pike', weaponType: 'Martial Melee', damage: '1d10', damageType: 'piercing', properties: ['Heavy', 'Reach', 'Two-Handed'] },
        longbow: { baseItem: 'Longbow', weaponType: 'Martial Ranged', damage: '1d8', damageType: 'piercing', properties: ['Heavy', 'Two-Handed', 'Ammunition'] },
        shortbow: { baseItem: 'Shortbow', weaponType: 'Simple Ranged', damage: '1d6', damageType: 'piercing', properties: ['Two-Handed', 'Ammunition'] },
        whip: { baseItem: 'Whip', weaponType: 'Martial Melee', damage: '1d4', damageType: 'slashing', properties: ['Finesse', 'Reach'] },
        trident: { baseItem: 'Trident', weaponType: 'Martial Melee', damage: '1d8', damageType: 'piercing', properties: ['Thrown', 'Versatile'] }
      };

      const baseItemMatch = cleaned.match(/Weapon\s*\(([^)]+)\)/i);
      const rawMatch = baseItemMatch ? baseItemMatch[1].toLowerCase() : name.toLowerCase();
      let matchedKey: string | undefined;

      for (const key of Object.keys(WEAPON_DEFS)) {
        if (rawMatch.includes(key) || name.toLowerCase().includes(key)) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey && WEAPON_DEFS[matchedKey]) {
        const def = WEAPON_DEFS[matchedKey];
        clone.baseItem = def.baseItem;
        clone.weaponType = def.weaponType;
        clone.damage = def.damage;
        clone.damageType = def.damageType;
        clone.properties = [...def.properties];
      } else if (baseItemMatch) {
        const raw = baseItemMatch[1].trim();
        clone.baseItem = raw.charAt(0).toUpperCase() + raw.slice(1);
        clone.damage = '1d6';
        clone.damageType = 'slashing';
        clone.weaponType = 'Simple Melee';
        clone.properties = [];
      } else {
        clone.baseItem = name.replace(/\s*\+[1-3]\b/i, '').trim();
        clone.damage = '1d6';
        clone.damageType = 'slashing';
        clone.weaponType = 'Simple Melee';
        clone.properties = [];
      }
    }
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractWeapon(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const name = this.cleanName(lines[0] || 'Weapon');

    const catMatch = cleaned.match(/(Simple|Martial)\s+(Melee|Ranged)\s*(?:Weapons?)?/i);
    const costMatch = cleaned.match(/Cost:\s*([0-9.,]+)\s*(GP|SP|CP|EP|PP)?/i);
    const dmgMatch = cleaned.match(/Damage:\s*([0-9d+\-\s]+)\s*([a-zA-Z]+)?/i);
    const wtMatch = cleaned.match(/Weight:\s*([0-9./]+)\s*(?:lbs?\.?|pounds?)?/i);
    const propMatch = cleaned.match(/Properties:\s*([^\n]+)/i);
    const masteryMatch = cleaned.match(/Mastery:\s*([^\n]+)/i);

    let weight = 1;
    if (wtMatch) {
      if (wtMatch[1].includes('/')) {
        const parts = wtMatch[1].split('/');
        weight = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        weight = parseFloat(wtMatch[1]) || 1;
      }
    }

    const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) || 0 : 0;
    const damage = dmgMatch ? dmgMatch[1].trim() : '1d6';
    const damageType = dmgMatch && dmgMatch[2] ? dmgMatch[2].toLowerCase().trim() : 'slashing';
    const category = catMatch ? `${catMatch[1]} ${catMatch[2]} Weapons` : 'Simple Melee Weapons';
    const properties = propMatch ? propMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    const masteries = masteryMatch ? masteryMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

    const defaultDesc = `Proficiency with a ${name} allows you to add your proficiency bonus to the attack roll for any attack you make with it.`;

    const clone = {
      ...WEAPON_TEMPLATE,
      ...schema,
      name,
      category,
      damage,
      damageType,
      weight,
      cost,
      properties,
      masteries,
      description: defaultDesc,
      type: 'weapon',
      isMagical: false,
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractArmor(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const name = this.cleanName(lines[0] || 'Armor');

    const typeMatch = cleaned.match(/(Light|Medium|Heavy|Shield)/i);
    const acMatch = cleaned.match(/Armor\s*Class:\s*([^\n]+)/i);
    const strMatch = cleaned.match(/Strength:\s*([0-9]+)/i);
    const stealthMatch = cleaned.match(/Stealth:\s*([^\n]+)/i);
    const costMatch = cleaned.match(/Cost:\s*([0-9.,]+)\s*(?:GP)?/i);
    const wtMatch = cleaned.match(/Weight:\s*([0-9.]+)\s*(?:lbs?\.?)?/i);

    const armorType = typeMatch ? typeMatch[1] : (name.toLowerCase().includes('shield') ? 'Shield' : 'Medium');
    const armorClass = acMatch ? acMatch[1].trim() : (armorType === 'Shield' ? '2' : '10 + Dex');
    const strengthRequirement = strMatch ? parseInt(strMatch[1], 10) : undefined;
    const stealthDisadvantage = stealthMatch ? stealthMatch[1].toLowerCase().includes('disadvantage') : false;
    const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) || 0 : 0;
    const weight = wtMatch ? parseFloat(wtMatch[1]) || 0 : (armorType === 'Shield' ? 6 : 20);

    const descLines = lines.filter(l =>
      !l.match(/^(Light|Medium|Heavy|Shield|Cost:|Armor Class:|Strength:|Stealth:|Weight:)/i) &&
      l !== name
    );
    const description = descLines.join(' ') || `${name} provides physical protection in combat.`;

    const clone = {
      ...ARMOR_TEMPLATE,
      ...schema,
      name,
      armorType,
      armorClass,
      strengthRequirement,
      stealthDisadvantage,
      cost,
      weight,
      description,
      type: 'armor',
      isMagical: false,
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractItem(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const name = this.cleanName(lines[0] || 'Item');

    const costMatch = cleaned.match(/Cost:\s*([^\n]+)/i);
    const wtMatch = cleaned.match(/Weight:\s*([^\n]+)/i);

    const cost = costMatch ? costMatch[1].trim() : '';
    const weight = wtMatch ? wtMatch[1].trim() : '';

    const descLines = lines.filter(l =>
      !l.match(/^(Cost:|Weight:|Tool|Adventuring Gear|Utility)/i) &&
      l !== name
    );
    const description = descLines.join(' ') || `${name} is an item for adventuring.`;

    const clone = {
      ...ITEM_TEMPLATE,
      ...schema,
      name,
      cost,
      weight,
      description,
      type: 'equipment',
      translations: {}
    };
    delete clone._id;
    delete clone.rarity;
    delete clone.attunement;

    return JSON.stringify(clone, null, 2);
  }

  private extractClass(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const name = this.cleanName(lines[0] || 'Class');

    // 1. Hit Die
    let hitDie = '1d8';
    const hitDieMatch =
      cleaned.match(/Hit\s+Dice:\s*(\d*d\d+)/i) ||
      cleaned.match(/Hit\s+(?:Point\s+)?(?:Die|Dice)\s*:\s*(\d*d\d+)/i) ||
      cleaned.match(/(?:Hit Point Die|Hit Point Dice|Hit Die|Hit Dice)\s*:\s*(?:1?d\d+|d\d+)(?:\s+per\s+[a-zA-Z\s]+level)?/i) ||
      cleaned.match(/\b(1?d[468]|1?d1[02]|d[468]|d1[02])\b/i);
    if (hitDieMatch) {
      const raw = hitDieMatch[1] || hitDieMatch[0];
      const hdRaw = raw.match(/1?d(4|6|8|10|12)/i);
      if (hdRaw) {
        hitDie = hdRaw[0].toLowerCase().startsWith('1') ? hdRaw[0].toLowerCase() : `1${hdRaw[0].toLowerCase()}`;
      }
    }

    // 2. Primary Ability
    let primaryAbility = 'Strength';
    const paMatch = cleaned.match(/Primary\s*Abilit(?:y|ies)\s*:\s*([^\n]+)/i);
    if (paMatch) {
      const paClean = paMatch[1].replace(/or\s+/i, '').split(/[,/]/).map(s => s.trim()).filter(Boolean);
      primaryAbility = paClean[0] || 'Strength';
    }

    // 3. Saving Throw Proficiencies
    let savingThrowProficiency: string[] = ['Strength', 'Constitution'];
    const stMatch = cleaned.match(/Saving\s*Throw\s*Proficienc(?:y|ies)\s*:\s*([^\n]+)/i);
    if (stMatch) {
      savingThrowProficiency = stMatch[1].split(/[,/]/).map(s => s.trim()).filter(Boolean);
    }

    // 4. Armor Proficiencies
    let armorProficiency: string[] = [];
    const armorMatch = cleaned.match(/Armor\s*(?:Training|Proficienc(?:y|ies))\s*:\s*([^\n]+)/i);
    if (armorMatch) {
      armorProficiency = armorMatch[1].split(/[,;]/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
    }

    // 5. Weapon Proficiencies
    let weaponProficiency: string[] = [];
    const wpMatch = cleaned.match(/Weapon\s*Proficienc(?:y|ies)\s*:\s*([^\n]+)/i);
    if (wpMatch) {
      weaponProficiency = wpMatch[1].split(/[,;]/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
    }

    // 6. Tool Proficiencies
    let toolProficiency: string[] = [];
    const tpMatch = cleaned.match(/Tool\s*Proficienc(?:y|ies)\s*:\s*([^\n]+)/i);
    if (tpMatch) {
      toolProficiency = tpMatch[1].split(/[,;]/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
    }

    // 7. Skill Proficiencies
    let skillProficiency: string[] = [];
    const skMatch = cleaned.match(/Skill\s*Proficienc(?:y|ies)\s*:\s*(?:Choose\s*\d+\s*(?:from\s*)?)?([^\n]+)/i);
    if (skMatch) {
      skillProficiency = skMatch[1].replace(/^Choose\s*\d+[^:]*:\s*/i, '').split(/[,;]/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
    }

    // 8. Starting Equipment
    let startingEquipment = '';
    const eqMatch = cleaned.match(/Starting\s*Equipment\s*:\s*([^\n]+(?:\n[^\n]+)?)/i);
    if (eqMatch) {
      startingEquipment = eqMatch[1].trim();
    }

    // 9. Class Features
    const entries = this.parseEntries(cleaned);
    const features = entries
      .filter(e => !/^(?:Core\s+[A-Za-z]+\s+Traits|Primary\s+Ability|Hit\s+(?:Point\s+)?(?:Die|Dice)|Saving\s+Throw|Armor\s+Training|Weapon\s+Proficienc|Tool\s+Proficienc|Skill\s+Proficienc|Starting\s+Equipment|Level\s+\d+|Source)/i.test(e.name))
      .map(e => {
        const lvlMatch = e.description.match(/(?:At|Starting\s+at)\s+(\d+)(?:st|nd|rd|th)?\s+level/i);
        return {
          name: e.name,
          description: e.description,
          category: 'Combat',
          classLevel: lvlMatch ? parseInt(lvlMatch[1], 10) : 1
        };
      });

    const clone: any = {
      ...CLASS_TEMPLATE,
      name,
      description: `The ${name} class masters combat maneuvers and unique class abilities.`,
      hitDie,
      primaryAbility,
      savingThrowProficiency,
      armorProficiency,
      weaponProficiency,
      toolProficiency,
      skillProficiency,
      startingEquipment: startingEquipment || `Starting equipment for ${name}.`,
      features: features.length > 0 ? features : CLASS_TEMPLATE.features,
      traits: {
        hitDie,
        primaryAbility: [primaryAbility],
        savingThrowProficiencies: savingThrowProficiency,
        armorProficiencies: armorProficiency,
        weaponProficiencies: weaponProficiency,
        toolProficiencies: toolProficiency,
        skillProficiencies: { choose: 2, from: skillProficiency },
        startingEquipment: { description: startingEquipment }
      },
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractSubclass(text: string, schema: any, options: NormalizeOptions): string {
    const cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const name = this.cleanName(lines[0] || 'Subclass');

    // 1. Parent Class Name
    let className = 'Fighter';
    const classMatch = cleaned.match(/([A-Z][a-zA-Z]+)\s+Subclass\b/i) ||
      cleaned.match(/Subclass\s+for\s+([A-Z][a-zA-Z]+)\b/i) ||
      cleaned.match(/(?:Fighter|Barbarian|Wizard|Rogue|Cleric|Paladin|Druid|Bard|Monk|Ranger|Sorcerer|Warlock)\s+(?:Archetype|Subclass)/i);
    if (classMatch) {
      const matchWord = classMatch[1] || classMatch[0].split(/\s+/)[0];
      className = matchWord.charAt(0).toUpperCase() + matchWord.slice(1).toLowerCase();
    }

    // 2. Features with Level Fallback (Kickoff Level 3) & Action Economy Classification
    const entries = this.parseEntries(cleaned);
    const features = entries
      .filter(e => e.name.toLowerCase() !== name.toLowerCase() && !/^(?:[A-Za-z]+\s+Subclass|Subclass|Source|Player's Handbook)/i.test(e.name))
      .map(e => {
        const text = `${e.name} ${e.description}`;
        const lvlMatch =
          text.match(/(?:At|Starting\s+at|by)\s+(\d+)(?:st|nd|rd|th)?\s+level/i) ||
          text.match(/\b(\d+)(?:st|nd|rd|th)[- ]level\b/i);

        let actionType = 'passive';
        if (/\b(?:bonus\s+action|as\s+a\s+bonus\s+action|use\s+a\s+bonus\s+action|a\s+bonus\s+action\s+to)\b/i.test(text)) {
          actionType = 'bonus action';
        } else if (/\b(?:reaction|as\s+a\s+reaction|use\s+your\s+reaction)\b/i.test(text)) {
          actionType = 'reaction';
        } else if (/\b(?:as\s+an\s+action|use\s+an\s+action|take\s+an\s+action|as\s+a\s+magic\s+action|action\s+to)\b/i.test(text)) {
          actionType = 'action';
        }

        return {
          name: e.name,
          description: e.description,
          level: lvlMatch ? parseInt(lvlMatch[1], 10) : 3,
          actionType
        };
      });

    // 3. Subclass Proficiencies (traits)
    const armorProficiencies: string[] = [];
    const weaponProficiencies: string[] = [];
    const toolProficiencies: string[] = [];
    const savingThrowProficiencies: string[] = [];

    const profMatch = cleaned.match(/(?:gain\s+proficiency\s+with|gain\s+proficiency\s+in|bonus\s+proficienc(?:y|ies)[^\n]*\n)([^\n.]+)/gi);
    const profText = (profMatch ? profMatch.join(' ') : '') + ' ' + cleaned;

    if (/\bheavy\s+armor\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      armorProficiencies.push('Heavy armor');
    }
    if (/\bmedium\s+armor\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      armorProficiencies.push('Medium armor');
    }
    if (/\blight\s+armor\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      armorProficiencies.push('Light armor');
    }
    if (/\bshields?\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      armorProficiencies.push('Shields');
    }

    if (/\bmartial\s+weapons?\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      weaponProficiencies.push('Martial weapons');
    }
    if (/\bsimple\s+weapons?\b/i.test(profText) && /\b(?:proficiency|proficient|training)\b/i.test(profText)) {
      weaponProficiencies.push('Simple weapons');
    }

    if (/\bartisan['’]s\s+tools?\b/i.test(profText)) {
      toolProficiencies.push("Artisan's tools");
    }
    if (/\bdisguise\s+kit\b/i.test(profText)) {
      toolProficiencies.push('Disguise kit');
    }
    if (/\bpoisoner['’]s\s+kit\b/i.test(profText)) {
      toolProficiencies.push("Poisoner's kit");
    }
    if (/\bthieves['’]\s+tools\b/i.test(profText)) {
      toolProficiencies.push("Thieves' tools");
    }
    if (/\bmusical\s+instruments?\b/i.test(profText)) {
      toolProficiencies.push('Musical instrument');
    }
    if (/\bherbalism\s+kit\b/i.test(profText)) {
      toolProficiencies.push('Herbalism kit');
    }

    const stMatch = profText.match(/proficiency\s+in\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throws/i);
    if (stMatch) {
      savingThrowProficiencies.push(stMatch[1]);
    }

    const traits = {
      armorProficiencies,
      weaponProficiencies,
      toolProficiencies,
      savingThrowProficiencies
    };

    // 4. Maneuver Subclasses (e.g. Battle Master)
    const isManeuver =
      /battle\s*master/i.test(name) ||
      /\b(?:combat\s+superiority|superiority\s+dice|maneuver\s+options?|list\s+of\s+maneuvers)\b/i.test(cleaned);
    let subclassManeuverPackTag: string | undefined = undefined;
    let superiorityDiceType: string | undefined = undefined;
    if (isManeuver) {
      subclassManeuverPackTag = 'battle-master';
      const diceMatch = cleaned.match(/\b(?:die\s+is\s+a|dice\s+are)\s+(d[468]|d1[02])\b/i);
      superiorityDiceType = diceMatch ? diceMatch[1].toLowerCase() : 'd8';
    }

    // 5. Subclass Spellcasting (e.g. Eldritch Knight, Arcane Trickster)
    const isEldritchKnight = /eldritch\s+knight/i.test(name);
    const isArcaneTrickster = /arcane\s+trickster/i.test(name);
    const isNonCaster = ['Fighter', 'Rogue', 'Barbarian', 'Monk'].includes(className);
    const hasSpellcasting =
      isEldritchKnight ||
      isArcaneTrickster ||
      (isNonCaster && /\bSpellcasting\b/i.test(cleaned) && /\b(?:spell\s+slots|cantrips?)\b/i.test(cleaned));

    let spellcasting: any = undefined;
    if (hasSpellcasting) {
      let ability = 'Intelligence';
      if (/\bWisdom\s+is\s+your\s+spellcasting\s+ability\b/i.test(cleaned)) {
        ability = 'Wisdom';
      } else if (/\bCharisma\s+is\s+your\s+spellcasting\s+ability\b/i.test(cleaned)) {
        ability = 'Charisma';
      }
      spellcasting = {
        spellcastingAbility: ability,
        spellcastingType: 'known'
      };
    }

    const descLines = lines.slice(1).filter(l => !/^(?:[A-Z][a-zA-Z]+\s+Subclass|Source:)/i.test(l));
    const description = descLines[0] || `The ${name} is a martial archetype for the ${className}.`;

    const clone: any = {
      ...SUBCLASS_TEMPLATE,
      name,
      className,
      classId: className,
      description,
      traits,
      features: features.length > 0 ? features : SUBCLASS_TEMPLATE.features,
      ...(subclassManeuverPackTag && { subclassManeuverPackTag, superiorityDiceType }),
      ...(spellcasting && { spellcasting }),
      translations: {}
    };
    delete clone._id;

    return JSON.stringify(clone, null, 2);
  }

  private extractMonsterStatBlock(text: string, schema: any, options: NormalizeOptions): string {
    // 1. Sanitize text and markdown links: [Creature](url) -> Creature
    let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If text contains multiple monsters, isolate the first monster's stat block
    const monsterHeaderRegex = /(?:^|\n)([A-Z0-9\u00C0-\u024F][A-Za-z0-9\u00C0-\u024F'\u2019\u2018\s\-–—/]+?)\s*\n((?:(?:or|ou)\s+)?(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+(?:Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)(?:\s*\([^\)]+\))?[^\n]*)/gi;
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

    const sizeTypeRegex = /^(?:(?:or|ou)\s+)?((?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?)\s+([^,]+)(?:,\s*(.+))?$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(sizeTypeRegex);
      if (match) {
        size = MonsterStatExtractor.cleanSize(match[1].trim());
        type = MonsterStatExtractor.cleanType(match[2].trim());
        if (match[3]) alignment = match[3].trim();
        // The monster's authentic name immediately precedes the size/type line
        if (i > 0 && lines[i - 1]) {
          name = lines[i - 1].replace(/^[—–-]\s*/, '').trim();
        }
        break;
      }
    }

    const customType = MonsterStatExtractor.extractCustomType(cleaned) || `${size} ${type}`;

    // AC: Matches "Armor Class 16", "AC 16", "AC 16 Initiative +3 (13)"
    const acMatch = cleaned.match(/(?:Armor Class|AC)\s*[\n:]?\s*(\d+)/i);
    const armorClass = acMatch ? parseInt(acMatch[1], 10) : 10;
    const armorClassType = MonsterStatExtractor.extractArmorClassType(cleaned);

    // HP: Matches "Hit Points 66", "HP 66 (12d8 + 12)"
    const hpMatch = cleaned.match(/(?:Hit Points|HP)\s*[\n:]?\s*(\d+)/i);
    const hitPoints = hpMatch ? parseInt(hpMatch[1], 10) : 10;
    const hitDie = MonsterStatExtractor.extractHitDie(cleaned);

    // Speed
    const speedMatch = cleaned.match(/Speed:?\s*([^\n]+)/i);
    const speedRaw = speedMatch ? speedMatch[1].trim() : '30 ft.';
    const speed = MonsterStatExtractor.extractSpeedObject(speedRaw);

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

    // Initiative: Matches "Initiative +16 (26)", "AC 16 Initiative +3 (13)", or derives from Dex
    const initiative = MonsterStatExtractor.extractInitiative(cleaned, abilities.dexterity);
    const initiativeBonus = MonsterStatExtractor.extractInitiativeBonus(cleaned, abilities.dexterity);

    // Saving Throws: Matches both 2014 explicit format and 2024 Ability Score Mod Save table (proficient only)
    const savingThrows = MonsterStatExtractor.filterProficientSavingThrows(
      MonsterStatExtractor.extractSavingThrows(cleaned),
      abilities
    );

    // Skills
    const skillsMatch = cleaned.match(/Skills\s*[\n:]?\s*([^\n]+)/i);
    const skills = skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()) : [];

    // Resistances / Immunities / Vulnerabilities
    const damageLists = MonsterStatExtractor.extractDamageLists(cleaned);

    // Senses
    const sensesMatch = cleaned.match(/Senses\s*[\n:]?\s*([^\n]+)/i);
    const senses = sensesMatch ? sensesMatch[1].trim() : 'Passive Perception 10';
    const passivePerception = MonsterStatExtractor.extractPassivePerception(cleaned, senses, abilities.wisdom);

    // Languages
    const langMatch = cleaned.match(/Languages\s*[\n:]?\s*([^\n]+)/i);
    const languages = langMatch ? langMatch[1].trim() : '—';

    // Gear
    const gear = MonsterStatExtractor.extractGear(cleaned);

    // Challenge / CR: Matches "Challenge 4", "CR 4", "CR 4 (XP 1,100; PB +2)"
    const crMatch = cleaned.match(/(?:Challenge|CR)\s*[\n:]?\s*(\d+(?:\/\d+)?)/i);
    const challengeRating = crMatch ? crMatch[1] : '1';

    const pbMatch = cleaned.match(/PB\s*\+?(\d+)/i);
    const proficiencyBonus = pbMatch ? parseInt(pbMatch[1], 10) : 2;

    // High precision deterministic section parsing for Traits, Actions, Reactions, Legendary Actions
    const sections = this.parseMonsterSections(cleaned);

    const isActionValid = (act: any) => {
      if (!act || typeof act !== 'object') return false;
      const desc = (act.description || '').trim();
      if (!desc) return false;
      const actName = (act.name || '').trim();
      if (/^(?:legendary\s+action\s+uses|legendary\s+actions|actions?|traits?|reactions?|bonus\s+actions?)\b/i.test(actName)) {
        return false;
      }
      if (/spellcasting/i.test(actName) && /(?:does\s+not\s+(?:cast|have)|cannot\s+cast|no\s+spells|none\b|n\/a\b)/i.test(desc)) {
        return false;
      }
      return true;
    };

    const traits = sections.traits.map(t => MonsterActionParser.parseAction(t, 'traits')).filter(isActionValid);
    const actions = sections.actions.map(a => MonsterActionParser.parseAction(a, 'actions')).filter(isActionValid);
    const bonusActions = sections.bonusActions.map(b => MonsterActionParser.parseAction(b, 'bonusActions')).filter(isActionValid);
    const reactions = sections.reactions.map(r => MonsterActionParser.parseAction(r, 'reactions')).filter(isActionValid);
    const legendaryActions = sections.legendaryActions.map(l => MonsterActionParser.parseAction(l, 'legendaryActions')).filter(isActionValid);

    const textHasSpellcasting = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Spellcasting\b/i.test(cleaned);
    if (textHasSpellcasting && !actions.some(a => /spellcasting/i.test(a.name))) {
      const extractedSpell = MonsterStatExtractor.extractSpellcastingAction(cleaned);
      if (extractedSpell) {
        actions.push(MonsterActionParser.parseAction(extractedSpell, 'actions'));
      }
    }

    const legendaryActionUses = MonsterStatExtractor.extractLegendaryActionUses(cleaned) ?? (legendaryActions.length > 0 ? 3 : undefined);

    const result: any = {
      ...MONSTER_TEMPLATE,
      name,
      type,
      customType,
      size,
      alignment,
      armorClass,
      ...(armorClassType && { armorClassType }),
      initiative,
      initiativeBonus,
      hitPoints,
      ...(hitDie && { hitDie }),
      speed,
      abilities,
      savingThrows,
      skills,
      damageResistances: damageLists.damageResistances,
      damageImmunities: damageLists.damageImmunities,
      damageVulnerabilities: damageLists.damageVulnerabilities,
      conditionImmunities: damageLists.conditionImmunities,
      senses,
      passivePerception,
      languages,
      ...(gear.length > 0 && { gear }),
      challengeRating,
      proficiencyBonus,
      traits,
      actions,
      bonusActions,
      reactions,
      legendaryActions,
      ...(legendaryActionUses !== undefined && { legendaryActionUses }),
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
      { type: 'legendaryActions', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?Legendary\s+Actions?:?(?:\*\*)?\s*(?:\n|$)/i },
      { type: 'stop', regex: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Lair\s+Actions?|Regional\s+Effects?|Habitat:|Treasure:):?(?:\*\*)?\s*(?:\n|$)/i }
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
      if (current.type === 'stop') continue;
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
      if (/^(?:Habitat:|Treasure:|Roll on\s|\d+d\d+\b|Rule\s+\d+:|[—–-]\s*[A-Z]|(?:#{1,6}\s*)?(?:\*\*)?(?:Lair\s+Actions?|Regional\s+Effects?))/i.test(line)) {
        break;
      }

      // Skip generic section intros or repeated section headings
      if (/^(?:[*_]{1,3})?\s*(?:traits|special\s+traits|actions?|bonus\s+actions?|reactions?|legendary\s+actions?|mythic\s+actions?):?\s*(?:[*_]{1,3})?$/i.test(line)) {
        continue;
      }
      if (/^(?:[*_]{1,3})?\s*legendary\s+actions?(?:\s+uses)?:/i.test(line)) {
        continue;
      }
      if (/^(?:the\s+[a-z0-9\u00C0-\u024F\s\-–—]+|creature\s+|monster\s+)?can\s+take\s+\d+\s+legendary\s+actions/i.test(line)) {
        continue;
      }
      if (/^only\s+one\s+legendary\s+action\s+(?:option\s+)?can\s+be\s+used\s+at\s+a\s+time/i.test(line)) {
        continue;
      }
      if (/^(?:the\s+[a-z0-9\u00C0-\u024F\s\-–—]+)?regains\s+spent\s+legendary\s+actions/i.test(line)) {
        continue;
      }

      // Check for markdown heading: ### Title
      const hMatch = line.match(/^###\s+([^\n]+)/);
      if (hMatch) {
        if (current) entries.push(current);
        current = { name: hMatch[1].trim(), description: '' };
        continue;
      }

      // Check for standalone bold title: **Title.** or **Title**
      const standaloneTitle = line.match(/^[*_]{2,3}([A-Z0-9\u00C0-\u024F][A-Za-z0-9\u00C0-\u024F'\u2019\u2018"\u201C\u201D`´,:\s\(\)\/\-–—‒―]+?)[.:]?[*_]{2,3}$/);
      if (standaloneTitle) {
        const potentialName = standaloneTitle[1].replace(/^[*_]+|[*_]+$/g, '').trim();
        const nameWithoutParens = potentialName.replace(/\([^)]*\)/g, '').trim();
        if (
          potentialName.length <= 60 &&
          !/[,;!?]/.test(nameWithoutParens) &&
          !/^(?:Speed|AC|HP|Ability|Score|Mod|Save|Str|Dex|Con|Int|Wis|Cha|The|Such|These|Those|When|If|After|Failure|Success|Trigger|Response|At\s+Will|Constant|\d+\/Day|\d+(?:st|nd|rd|th)\s+level|Cantrips)\b/i.test(potentialName)
        ) {
          if (current) entries.push(current);
          current = {
            name: potentialName,
            description: ''
          };
          continue;
        }
      }

      // Check for standalone title line: Rage, Unarmored Defense, Channel Divinity: Preserve Life, etc.
      const cleanLine = line.replace(/^[*_]+|[*_]+$/g, '').trim();
      const isHeaderKey = /^(?:Casting\s+Time|Range|Components|Duration|Classes|Damage|Speed|AC|HP|Hit\s+(?:Point\s+)?(?:Die|Dice)|Saving\s+Throw|Skill\s+Proficienc|Tool\s+Proficienc|Armor\s+Training|Weapon\s+Proficienc|Starting\s+Equipment|Source|Prerequisite|Level\s+\d+)\s*:/i.test(cleanLine);

      if (
        !isHeaderKey &&
        /^[A-Z0-9\u00C0-\u024F][A-Za-z0-9\u00C0-\u024F'\u2019\u2018\s\-–—/()]+(?::\s+[A-Za-z0-9\u00C0-\u024F'\u2019\u2018\s\-–—/()]+)?$/.test(cleanLine) &&
        cleanLine.length <= 60 &&
        !/[,;!?]/.test(cleanLine) &&
        !cleanLine.endsWith('.') &&
        !/^(?:Speed|AC|HP|Ability|Score|Mod|Save|Str|Dex|Con|Int|Wis|Cha|The|Such|These|Those|When|If|After|Failure|Success|Trigger|Response|Level\s+\d+|Source|Choose\s+\d+|Starting\s+Equipment|Armor\s+Training|Hit\s+(?:Point\s+)?(?:Die|Dice)|Primary\s+Ability|Saving\s+Throw|Skill\s+Proficienc|Weapon\s+Proficienc)\b/i.test(cleanLine)
      ) {
        if (current) entries.push(current);
        current = {
          name: cleanLine,
          description: ''
        };
        continue;
      }

      // Check for Title. Description or **Title.** Description or Title (Extra). Description
      // Supports standard ASCII apostrophe ' as well as typographic / curly ’ (\u2019) and ‘ (\u2018)
      const titleMatch = line.match(
        /^(?:[*_]{1,3})?([A-Z0-9\u00C0-\u024F][A-Za-z0-9\u00C0-\u024F'\u2019\u2018"\u201C\u201D`´,:\s\(\)\/\-–—‒―]+?)(?:[*_]{1,3}\s*[.:]|[.:]\s*[*_]{1,3}|[.:])\s+(.+)$/
      );
      if (titleMatch) {
        const potentialName = titleMatch[1].replace(/^[*_]+|[*_]+$/g, '').trim();
        const nameWithoutParens = potentialName.replace(/\([^)]*\)/g, '').trim();
        if (
          potentialName.length <= 60 &&
          !/[,;!?]/.test(nameWithoutParens) &&
          !/^(?:Speed|AC|HP|Ability|Score|Mod|Save|Str|Dex|Con|Int|Wis|Cha|The|Such|These|Those|When|If|After|Failure|Success|Trigger|Response|At\s+Will|Constant|\d+\/Day|\d+(?:st|nd|rd|th)\s+level|Cantrips)\b/i.test(potentialName)
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

    return entries.filter(e => {
      if (!e || !e.name) return false;
      const desc = (e.description || '').trim();
      if (!desc) return false;
      if (/^(?:legendary\s+action\s+uses|legendary\s+actions|actions?|traits?|reactions?|bonus\s+actions?)\b/i.test(e.name.trim())) {
        return false;
      }
      return true;
    });
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
        actions: sections.actions.filter(a => a.description && a.description.trim().length > 0),
        bonusActions: sections.bonusActions.filter(b => b.description && b.description.trim().length > 0),
        reactions: sections.reactions.filter(r => r.description && r.description.trim().length > 0)
      }, null, 2);
    }
    const actions = this.parseEntries(text).filter(a => a.description && a.description.trim().length > 0);
    return JSON.stringify({ actions }, null, 2);
  }

  private extractSectionalBonusActions(text: string): string {
    const bonusActions = this.parseEntries(text).filter(b => b.description && b.description.trim().length > 0);
    return JSON.stringify({ bonusActions }, null, 2);
  }

  private extractSectionalLegendary(text: string): string {
    const legendaryActions = this.parseEntries(text).filter(l => l.description && l.description.trim().length > 0);
    const legendaryActionUses = MonsterStatExtractor.extractLegendaryActionUses(text) ?? (legendaryActions.length > 0 ? 3 : undefined);
    return JSON.stringify({
      legendaryActions,
      ...(legendaryActionUses !== undefined && { legendaryActionUses })
    }, null, 2);
  }

  private extractSectionalReactions(text: string): string {
    const reactions = this.parseEntries(text).filter(r => r.description && r.description.trim().length > 0);
    return JSON.stringify({ reactions }, null, 2);
  }
}
