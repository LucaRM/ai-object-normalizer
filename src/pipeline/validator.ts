import {
  NormalizeOptions,
  ValidationResult,
  CoercedField,
  EntityRelation,
  NormalizerError,
  ErrorType
} from '../types';
import { ObjectIdHelper } from './objectId';
import { MonsterStatExtractor } from './monsterExtractor';
import { MonsterActionParser } from './actionParser';

export class PropertyValidator {
  /**
   * Safely extracts and parses JSON from raw LLM output,
   * handling code fences, comments, and common formatting anomalies.
   */
  static extractJson(rawText: string): any {
    if (!rawText || typeof rawText !== 'string') {
      throw new NormalizerError('Empty response from model', ErrorType.PARSE_ERROR);
    }

    let cleaned = rawText.trim();

    // Remove markdown code fences ```json ... ``` or ```javascript ... ``` or ``` ... ```
    const fenceMatch = cleaned.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) {
      cleaned = fenceMatch[1].trim();
    }

    // Replace MongoDB Shell syntax like ObjectId('...'), NumberInt('...'), ISODate('...') with valid JSON equivalents
    cleaned = cleaned
      .replace(/ObjectId\s*\(\s*['"]([0-9a-fA-F]{24})['"]\s*\)/g, '"$1"')
      .replace(/NumberInt\s*\(\s*['"]?(-?\d+)['"]?\s*\)/g, '$1')
      .replace(/ISODate\s*\(\s*['"]([^'"]+)['"]\s*\)/g, '"$1"');

    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned
      .replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(cleaned);
    } catch (firstErr: any) {
      // Find the first '{' and last '}'
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const sliced = cleaned.substring(start, end + 1);
        try {
          return JSON.parse(sliced);
        } catch (secondErr: any) {
          throw new NormalizerError(
            `Failed to parse model output as JSON: ${secondErr.message}. Raw preview: "${cleaned.substring(0, 150)}..."`,
            ErrorType.PARSE_ERROR
          );
        }
      }

      throw new NormalizerError(
        `Failed to parse model output as JSON: ${firstErr.message}`,
        ErrorType.PARSE_ERROR
      );
    }
  }

  /**
   * Runs the full validation, property checks, and normalization pipeline
   */
  static normalizeAndValidate(
    rawObject: any,
    targetSchema: any,
    options: NormalizeOptions = {}
  ): { normalized: any; validation: ValidationResult; relations: EntityRelation[] } {
    const coercedFields: CoercedField[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let checksRun = 0;

    const data: any = { ...rawObject };

    // Apply defaults provided in options
    if (options.defaults) {
      for (const [key, val] of Object.entries(options.defaults)) {
        if (data[key] === undefined || data[key] === null) {
          data[key] = val;
          coercedFields.push({
            path: key,
            original: undefined,
            coerced: val,
            reason: 'Applied caller default value'
          });
        }
      }
    }

    // Route to appropriate model validator
    const tmpl = (options.template || '').toLowerCase().trim();
    if (tmpl === 'monster') {
      this.validateMonsterProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'spell') {
      this.validateSpellProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'magical-item' || tmpl === 'magicalitem' || tmpl === 'magicitem' || tmpl === 'magic-item') {
      this.validateMagicalItemProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'species' || tmpl === 'race') {
      this.validateSpeciesProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'class') {
      this.validateClassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'subclass') {
      this.validateSubclassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'feat') {
      this.validateFeatProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'background') {
      this.validateBackgroundProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'weapon') {
      this.validateWeaponProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'armor' || tmpl === 'armour' || tmpl === 'shield') {
      this.validateArmorProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'item' || tmpl === 'equipment' || tmpl === 'gear') {
      this.validateItemProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && (targetSchema.challengeRating !== undefined || (targetSchema.armorClass !== undefined && targetSchema.hitPoints !== undefined))) {
      this.validateMonsterProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.castingAction !== undefined) {
      this.validateSpellProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && (targetSchema.rarity !== undefined || targetSchema.maxCharges !== undefined || (targetSchema.entityType !== undefined && targetSchema.type === 'magic-item'))) {
      this.validateMagicalItemProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.armorType !== undefined) {
      this.validateArmorProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.masteries !== undefined && targetSchema.damageType !== undefined) {
      this.validateWeaponProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.baseSpeed !== undefined && targetSchema.baseLanguages !== undefined) {
      this.validateSpeciesProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.levelProgression !== undefined) {
      this.validateClassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.className !== undefined && targetSchema.classId !== undefined) {
      this.validateSubclassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.featType !== undefined) {
      this.validateFeatProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.feat !== undefined && targetSchema.skillProficiency !== undefined) {
      this.validateBackgroundProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && targetSchema.type === 'equipment') {
      this.validateItemProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (targetSchema && typeof targetSchema === 'object') {
      this.validateGenericProperties(data, targetSchema, coercedFields, warnings, errors, () => checksRun++);
    }

    // Ensure _id
    checksRun++;
    if (!data._id || !ObjectIdHelper.isValid(data._id)) {
      const newId = ObjectIdHelper.generate();
      coercedFields.push({
        path: '_id',
        original: data._id,
        coerced: newId,
        reason: 'Generated valid 24-hex MongoDB ObjectId'
      });
      data._id = newId;
    }

    // Ensure system and edition naming conventions (strictly "D&D 5.5e" for 2024 or echoes options.system)
    this.resolveSystem(data, options, coercedFields, () => checksRun++);

    // Ensure timestamps
    const now = new Date().toISOString();
    if (!data.createdAt) {
      data.createdAt = now;
      coercedFields.push({
        path: 'createdAt',
        original: undefined,
        coerced: now,
        reason: 'Generated current ISO timestamp'
      });
    }
    if (!data.updatedAt) {
      data.updatedAt = now;
      coercedFields.push({
        path: 'updatedAt',
        original: undefined,
        coerced: now,
        reason: 'Generated current ISO timestamp'
      });
    }

    // Ensure createdBy / updatedBy
    if (data.createdBy === undefined) data.createdBy = 'system';
    if (data.updatedBy === undefined) data.updatedBy = 'system';

    // Custom check rules
    if (options.customChecks && Array.isArray(options.customChecks)) {
      for (const rule of options.customChecks) {
        checksRun++;
        const currentVal = this.getNestedValue(data, rule.field);
        const result = rule.validator(currentVal, data);
        if (result !== true) {
          const errMsg = typeof result === 'string' ? result : `Failed custom check: ${rule.name}`;
          if (rule.fixer) {
            const fixed = rule.fixer(currentVal, data);
            this.setNestedValue(data, rule.field, fixed);
            coercedFields.push({
              path: rule.field,
              original: currentVal,
              coerced: fixed,
              reason: `Fixed via rule ${rule.name}: ${errMsg}`
            });
            warnings.push(`Rule ${rule.name} auto-fixed field ${rule.field}`);
          } else {
            errors.push(errMsg);
          }
        }
      }
    }

    const isValid = errors.length === 0;

    if (!isValid && options.strict) {
      throw new NormalizerError(
        `Validation failed in strict mode: ${errors.join('; ')}`,
        ErrorType.VALIDATION_ERROR
      );
    }

    const relations = this.extractRelations(data, options.template);

    return {
      normalized: data,
      validation: {
        isValid,
        checksRun,
        coercedFields,
        warnings,
        errors
      },
      relations
    };
  }

  /**
   * Identifies foreign entity references in the normalized object
   * so importing scripts (e.g. in luca-app) can resolve names to ObjectIds
   */
  static extractRelations(data: any, templateName?: string): EntityRelation[] {
    const relations: EntityRelation[] = [];
    const tmpl = (templateName || '').toLowerCase().trim();

    // Background -> Feat
    if ((tmpl === 'background' || data.skillProficiency !== undefined) && data.feat && typeof data.feat === 'string') {
      relations.push({
        field: 'feat',
        targetCollection: 'feats',
        value: data.feat
      });
    }

    // Subclass -> Class
    if ((tmpl === 'subclass' || data.className !== undefined) && data.classId) {
      relations.push({
        field: 'classId',
        targetCollection: 'classes',
        value: data.classId
      });
    }

    // MagicalItem -> Base Item
    if ((tmpl === 'magical-item' || tmpl === 'magicalitem') && data.baseItem && typeof data.baseItem === 'string') {
      relations.push({
        field: 'baseItem',
        targetCollection: 'items',
        value: data.baseItem
      });
    }

    // Books references (Monster, Spell, Class, Background, Feat, Species, etc.)
    if (Array.isArray(data.books) && data.books.length > 0) {
      relations.push({
        field: 'books',
        targetCollection: 'books',
        value: data.books
      });
    }

    // Spell -> Classes
    if (tmpl === 'spell' && Array.isArray(data.classes) && data.classes.length > 0) {
      relations.push({
        field: 'classes',
        targetCollection: 'classes',
        value: data.classes
      });
    }

    return relations;
  }

  /**
   * D&D 5e / Monster model specific property checks
   */
  private static validateMonsterProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    // 1. Name
    tickCheck();
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Monster "name" is required and must be a string');
    } else {
      data.name = data.name.trim();
    }

    // 2. Size
    tickCheck();
    const validSizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    const validTypes = [
      'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon',
      'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid',
      'Monstrosity', 'Ooze', 'Plant', 'Undead'
    ];

    if (data.size && typeof data.size === 'string') {
      const match = validSizes.find(s => s.toLowerCase() === data.size.toLowerCase());
      if (match) {
        if (match !== data.size) {
          coercedFields.push({
            path: 'size',
            original: data.size,
            coerced: match,
            reason: 'Normalized size casing'
          });
          data.size = match;
        }
      } else {
        // If size was accidentally assigned creature name/word (e.g. "Aarakocra"), try to recover
        const recoveredSize = validSizes.find(s => new RegExp(`\\b${s}\\b`, 'i').test(data.type || ''));
        if (recoveredSize) {
          coercedFields.push({
            path: 'size',
            original: data.size,
            coerced: recoveredSize,
            reason: 'Recovered valid size from type string'
          });
          data.size = recoveredSize;
        } else {
          data.size = 'Medium';
          coercedFields.push({
            path: 'size',
            original: data.size,
            coerced: 'Medium',
            reason: 'Defaulted invalid size to Medium'
          });
        }
      }
    } else {
      data.size = 'Medium';
      coercedFields.push({
        path: 'size',
        original: data.size,
        coerced: 'Medium',
        reason: 'Defaulted missing size to Medium'
      });
    }

    // 3. Type & Alignment
    tickCheck();
    if (!data.type || typeof data.type !== 'string') {
      data.type = 'Beast';
    } else {
      let cleanType = MonsterStatExtractor.cleanType(data.type);
      if (cleanType.length > 50 || cleanType.endsWith('.')) {
        // Lore text was accidentally captured as creature type
        const foundType = validTypes.find(t => new RegExp(`\\b${t}\\b`, 'i').test(cleanType));
        if (foundType) {
          cleanType = foundType;
        }
      }
      if (cleanType !== data.type) {
        coercedFields.push({
          path: 'type',
          original: data.type,
          coerced: cleanType,
          reason: 'Sanitized type prefixes and formatting'
        });
        data.type = cleanType;
      }
    }
    if (!data.alignment) data.alignment = 'Unaligned';

    // 4. Armor Class
    tickCheck();
    if (data.armorClass !== undefined) {
      const acInt = parseInt(String(data.armorClass), 10);
      if (!isNaN(acInt) && acInt > 0) {
        if (data.armorClass !== acInt) {
          coercedFields.push({
            path: 'armorClass',
            original: data.armorClass,
            coerced: acInt,
            reason: 'Coerced armorClass to integer'
          });
          data.armorClass = acInt;
        }
      } else {
        warnings.push(`Invalid armorClass: ${data.armorClass}`);
      }
    }

    // 4b. Initiative
    tickCheck();
    if (!data.initiative || typeof data.initiative !== 'string' || data.initiative.trim().length === 0) {
      const derivedInit = MonsterStatExtractor.extractInitiative('', data.abilities?.dexterity);
      coercedFields.push({
        path: 'initiative',
        original: data.initiative,
        coerced: derivedInit,
        reason: 'Populated initiative using dexterity modifier'
      });
      data.initiative = derivedInit;
    } else {
      data.initiative = data.initiative.trim();
    }

    // 5. Hit Points
    tickCheck();
    if (data.hitPoints !== undefined) {
      const hpInt = parseInt(String(data.hitPoints), 10);
      if (!isNaN(hpInt) && hpInt > 0) {
        if (data.hitPoints !== hpInt) {
          coercedFields.push({
            path: 'hitPoints',
            original: data.hitPoints,
            coerced: hpInt,
            reason: 'Coerced hitPoints to integer'
          });
          data.hitPoints = hpInt;
        }
      } else {
        errors.push(`Invalid hitPoints: ${data.hitPoints}`);
      }
    }
    if (data.hitDie && typeof data.hitDie === 'string') {
      data.hitDie = data.hitDie.trim();
    }

    // 6. Speed
    tickCheck();
    if (typeof data.speed === 'object' && data.speed !== null) {
      if (!data.speed.walk && !data.speed.fly && !data.speed.swim && !data.speed.climb && !data.speed.burrow) {
        data.speed.walk = 30;
      }
    } else if (typeof data.speed === 'string') {
      data.speed = MonsterStatExtractor.extractSpeedObject(data.speed);
    } else {
      data.speed = { walk: 30 };
    }

    // 7. Abilities
    tickCheck();
    const abilityNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    if (!data.abilities || typeof data.abilities !== 'object') {
      data.abilities = {};
    }
    for (const ab of abilityNames) {
      const rawVal = data.abilities[ab];
      const intVal = parseInt(String(rawVal), 10);
      if (!isNaN(intVal) && intVal >= 1 && intVal <= 30) {
        if (rawVal !== intVal) {
          coercedFields.push({
            path: `abilities.${ab}`,
            original: rawVal,
            coerced: intVal,
            reason: `Coerced ${ab} score to integer`
          });
          data.abilities[ab] = intVal;
        }
      } else {
        warnings.push(`Missing or out-of-range ability score ${ab}: defaulting to 10`);
        data.abilities[ab] = 10;
      }
    }

    // 8. Challenge Rating
    tickCheck();
    if (data.challengeRating !== undefined) {
      data.challengeRating = String(data.challengeRating).trim();
    } else {
      data.challengeRating = '1';
    }

    // 9. Proficiency Bonus
    tickCheck();
    if (data.proficiencyBonus !== undefined) {
      const pbInt = parseInt(String(data.proficiencyBonus), 10);
      if (!isNaN(pbInt)) {
        data.proficiencyBonus = pbInt;
      }
    } else {
      data.proficiencyBonus = 2;
    }

    // 10. Arrays (skills, savingThrows, traits, actions, bonusActions, reactions, legendaryActions, books)
    tickCheck();
    data.skills = Array.isArray(data.skills) ? data.skills : (typeof data.skills === 'string' ? data.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    const rawSaves = Array.isArray(data.savingThrows) ? data.savingThrows : [];
    data.savingThrows = MonsterStatExtractor.filterProficientSavingThrows(rawSaves, data.abilities);

    const enrichAction = (act: any, i: number, category: string) => {
      if (typeof act === 'string') {
        const dotIndex = act.indexOf('.');
        const name = dotIndex > 0 ? act.substring(0, dotIndex).trim() : `Action ${i + 1}`;
        const description = dotIndex > 0 ? act.substring(dotIndex + 1).trim() : act;
        return MonsterActionParser.parseAction({ name, description }, category);
      }
      if (act && typeof act === 'object') {
        const name = act.name ? String(act.name).trim() : `Action ${i + 1}`;
        const description = act.description ? String(act.description).trim() : '';
        return MonsterActionParser.parseAction({ ...act, name, description }, category);
      }
      return MonsterActionParser.parseAction({ name: `Action ${i + 1}`, description: '' }, category);
    };

    const isActionValid = (act: any) => {
      if (!act || typeof act !== 'object') return false;
      const desc = (act.description || '').trim();
      if (!desc) return false;
      const name = (act.name || '').trim();
      // Drop introductory text (e.g. "Legendary Action Uses: 3 (4 in Lair)") or generic placeholder entries with no text
      if (/^(?:legendary\s+action\s+uses|legendary\s+actions|actions?|traits?|reactions?|bonus\s+actions?)\b/i.test(name)) {
        return false;
      }
      // Drop dummy negative spellcasting entries like "The assassin does not cast spells."
      if (/spellcasting/i.test(name) && /(?:does\s+not\s+(?:cast|have)|cannot\s+cast|no\s+spells|none\b|n\/a\b)/i.test(desc)) {
        return false;
      }
      return true;
    };

    data.traits = Array.isArray(data.traits) ? data.traits.map((t: any, i: number) => enrichAction(t, i, 'traits')).filter(isActionValid) : [];
    data.actions = Array.isArray(data.actions) ? data.actions.map((a: any, i: number) => enrichAction(a, i, 'actions')).filter(isActionValid) : [];
    data.bonusActions = Array.isArray(data.bonusActions) ? data.bonusActions.map((b: any, i: number) => enrichAction(b, i, 'bonusActions')).filter(isActionValid) : [];
    data.reactions = Array.isArray(data.reactions) ? data.reactions.map((r: any, i: number) => enrichAction(r, i, 'reactions')).filter(isActionValid) : [];
    data.legendaryActions = Array.isArray(data.legendaryActions) ? data.legendaryActions.map((l: any, i: number) => enrichAction(l, i, 'legendaryActions')).filter(isActionValid) : [];

    // 10b. Core combat automation properties
    if (data.initiativeBonus === undefined || (data.initiative && typeof data.initiative === 'string' && data.initiative.includes('+') && data.initiativeBonus === Math.floor(((data.abilities?.dexterity || 10) - 10) / 2))) {
      data.initiativeBonus = MonsterStatExtractor.extractInitiativeBonus(data.initiative, data.abilities?.dexterity);
    }
    if (data.passivePerception === undefined) {
      data.passivePerception = MonsterStatExtractor.extractPassivePerception(data.senses, data.senses, data.abilities?.wisdom);
    }
    if (data.gear === undefined) {
      data.gear = [];
    } else if (!Array.isArray(data.gear)) {
      data.gear = typeof data.gear === 'string' ? data.gear.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    }
    if (!data.customType && data.size && data.type) {
      data.customType = `${data.size} ${data.type}`;
    }
    if (data.legendaryActions.length > 0 && data.legendaryActionUses === undefined) {
      data.legendaryActionUses = 3;
    }

    // 11. Books array
    this.ensureBooksArray(data, options, coercedFields, tickCheck);

    // 12. Clean arrays for immunities, resistances, vulnerabilities
    const toCleanArray = (val: any) => {
      if (Array.isArray(val)) return val.map((s: any) => String(s).trim()).filter(Boolean);
      if (typeof val === 'string' && val.trim().length > 0 && val.trim() !== '—') {
        return val.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      return [];
    };

    data.damageResistances = toCleanArray(data.damageResistances);
    data.damageImmunities = toCleanArray(data.damageImmunities);
    data.damageVulnerabilities = toCleanArray(data.damageVulnerabilities);
    data.conditionImmunities = toCleanArray(data.conditionImmunities);
    data.languages = data.languages || '—';
    this.resolveSystem(data, options, coercedFields, tickCheck);

    // 13. Translations check if targetLocale is set
    tickCheck();
    if (options.targetLocale || (data.translations && Object.keys(data.translations).length > 0)) {
      const locale = options.targetLocale || Object.keys(data.translations)[0];
      if (!data.translations) data.translations = {};
      if (!data.translations[locale]) data.translations[locale] = {};

      const loc = data.translations[locale];
      if (!loc.name) loc.name = data.name;
      if (!loc.type) loc.type = data.type;
      if (!loc.alignment) loc.alignment = data.alignment;
      if (!loc.traits) loc.traits = [];
      if (!loc.reactions) loc.reactions = [];
      if (!loc.legendaryActions) loc.legendaryActions = [];
      if (!loc.languages) loc.languages = data.languages;
      if (!loc.senses) loc.senses = data.senses;

      if (!loc._metadata) {
        loc._metadata = {
          locale,
          translatedAt: new Date().toISOString(),
          source: 'AI_TRANSLATION',
          quality: 'DRAFT'
        };
      }
      if (!loc.metadata) {
        loc.metadata = {
          reviewed: false,
          translatedBy: 'ai'
        };
      }
    }
  }

  /**
   * Spell property validation
   */
  private static validateSpellProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Spell "name" is required');

    tickCheck();
    if (data.level !== undefined && data.level !== null) {
      if (typeof data.level === 'number') {
        data.level = Math.floor(data.level);
      } else {
        const lvlStr = String(data.level).trim().toLowerCase();
        if (/cantrip|truque/i.test(lvlStr) || lvlStr === '0') {
          data.level = 0;
        } else {
          const match = lvlStr.match(/\d+/);
          data.level = match ? parseInt(match[0], 10) : 0;
        }
      }
    } else {
      data.level = 0;
    }

    tickCheck();
    const validSchools = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
    if (data.school && typeof data.school === 'string') {
      const matched = validSchools.find(s => s.toLowerCase() === data.school.toLowerCase());
      if (matched) data.school = matched;
    }

    tickCheck();
    data.castingAction = data.castingAction || 'Action';
    data.castingTime = data.castingTime || data.castingAction;
    data.range = data.range || 'Self';
    data.duration = data.duration || 'Instantaneous';
    data.components = this.parseSpellComponents(data.components);
    data.ritual = Boolean(data.ritual);
    data.concentration = Boolean(data.concentration);
    data.classes = Array.isArray(data.classes) ? data.classes : [];
    this.resolveSystem(data, options, coercedFields, tickCheck);

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'atHigherLevels'], tickCheck);
  }

  /**
   * Parses and structures spell components into { verbal, somatic, material, materialsDescription? }
   */
  private static parseSpellComponents(components: any): {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialsDescription?: string;
  } {
    if (components && typeof components === 'object' && !Array.isArray(components)) {
      const verbal = Boolean(components.verbal);
      const somatic = Boolean(components.somatic);
      const material = Boolean(components.material);
      const desc = typeof components.materialsDescription === 'string'
        ? components.materialsDescription.trim()
        : (typeof components.description === 'string' ? components.description.trim() : undefined);

      return {
        verbal,
        somatic,
        material,
        ...(desc ? { materialsDescription: desc } : {})
      };
    }

    const compStr = Array.isArray(components) ? components.join(', ') : (typeof components === 'string' ? components : '');
    const verbal = /\bV\b/i.test(compStr) || /\bverbal\b/i.test(compStr);
    const somatic = /\bS\b/i.test(compStr) || /\bsomatic\b/i.test(compStr);
    const material = /\bM\b/i.test(compStr) || /\bmaterial\b/i.test(compStr);

    let materialsDescription: string | undefined = undefined;
    const parenMatch = compStr.match(/\(([^)]+)\)/);
    if (parenMatch) {
      materialsDescription = parenMatch[1].trim();
    } else if (material) {
      const afterMMatch = compStr.match(/\bM\s*[:\-–]\s*([^,;]+)/i);
      if (afterMMatch) {
        materialsDescription = afterMMatch[1].trim();
      }
    }

    if (!compStr) {
      return {
        verbal: true,
        somatic: true,
        material: false
      };
    }

    return {
      verbal,
      somatic,
      material,
      ...(materialsDescription ? { materialsDescription } : {})
    };
  }

  /**
   * Magical Item property validation
   */
  private static validateMagicalItemProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Magical Item "name" is required');

    tickCheck();
    const validRarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];
    if (data.rarity && typeof data.rarity === 'string') {
      const rLower = data.rarity.toLowerCase().trim();
      if (validRarities.includes(rLower)) {
        data.rarity = rLower;
      } else {
        warnings.push(`Unrecognized rarity "${data.rarity}"`);
      }
    } else {
      data.rarity = 'uncommon';
    }

    tickCheck();
    const validEntityTypes = ['weapon', 'armor', 'wondrous', 'ring', 'rod', 'staff', 'wand', 'potion', 'scroll', 'other'];
    if (data.entityType && typeof data.entityType === 'string') {
      data.entityType = data.entityType.toLowerCase().trim();
    } else {
      data.entityType = 'wondrous';
    }

    tickCheck();
    data.type = 'magic-item';
    data.requiresAttunement = Boolean(data.requiresAttunement);
    this.resolveSystem(data, options, coercedFields, tickCheck);

    // 1. Attack & Damage Bonuses (Weapons)
    if (data.magicBonusToHit !== undefined && data.magicBonusToHit !== null) {
      const b = parseInt(String(data.magicBonusToHit), 10);
      data.magicBonusToHit = isNaN(b) ? 0 : b;
    } else if (data.entityType === 'weapon') {
      data.magicBonusToHit = 0;
    }

    if (data.magicBonusToDamage !== undefined && data.magicBonusToDamage !== null) {
      const b = parseInt(String(data.magicBonusToDamage), 10);
      data.magicBonusToDamage = isNaN(b) ? 0 : b;
    } else if (data.entityType === 'weapon') {
      data.magicBonusToDamage = 0;
    }

    if ((!data.magicBonusToHit || data.magicBonusToHit === 0) || (!data.magicBonusToDamage || data.magicBonusToDamage === 0)) {
      const fullText = `${data.name || ''} ${data.description || ''} ${JSON.stringify(data.features || [])}`;
      const bonusMatch =
        fullText.match(/\+(\d+)\s+bonus\s+to\s+attack\s+rolls\s+and\s+damage\s+rolls/i) ||
        fullText.match(/(?:gain\s+a\s+|have\s+a\s+|\+)(\d+)\s+bonus\s+to\s+attack(?:\s+rolls)?\s+and\s+damage\s+rolls/i) ||
        fullText.match(/\+(\d+)\s+bonus\s+to\s+attack(?:\s+rolls)?\s+and\s+damage\s+rolls/i) ||
        fullText.match(/,\s*\+(\d+)\b/i) ||
        fullText.match(/\+(\d+)\s+weapon\b/i) ||
        (data.name ? data.name.match(/\+(\d+)\b/) : null);
      if (bonusMatch) {
        const bonus = parseInt(bonusMatch[1], 10);
        if (!data.magicBonusToHit || data.magicBonusToHit === 0) data.magicBonusToHit = bonus;
        if (!data.magicBonusToDamage || data.magicBonusToDamage === 0) data.magicBonusToDamage = bonus;
      }
    }

    if (data.extraDamage !== undefined && data.extraDamage !== null) {
      data.extraDamage = String(data.extraDamage).trim() || null;
    } else {
      data.extraDamage = null;
    }

    if (data.extraDamageType !== undefined && data.extraDamageType !== null) {
      data.extraDamageType = String(data.extraDamageType).toLowerCase().trim() || null;
    } else {
      data.extraDamageType = null;
    }

    // 2. Armor & Protection Bonuses (Armor, Shields, Rings, Cloaks)
    if (data.armorClassBonus !== undefined && data.armorClassBonus !== null) {
      const b = parseInt(String(data.armorClassBonus), 10);
      data.armorClassBonus = isNaN(b) ? 0 : b;
    } else {
      data.armorClassBonus = 0;
    }

    if (data.savingThrowBonus !== undefined && data.savingThrowBonus !== null) {
      const b = parseInt(String(data.savingThrowBonus), 10);
      data.savingThrowBonus = isNaN(b) ? 0 : b;
    } else {
      data.savingThrowBonus = 0;
    }

    // 3. Spells
    if (data.spells !== undefined && Array.isArray(data.spells)) {
      data.spells = data.spells.map((s: any) => String(s).trim()).filter(Boolean);
    } else {
      data.spells = [];
    }

    // Auto-infer spells if empty
    if (data.spells.length === 0) {
      const fullText = `${data.name || ''} ${data.description || ''} ${JSON.stringify(data.features || [])}`;
      const wandSpellMatch = fullText.match(/\b(?:Wand|Scroll|Staff|Ring)\s+of\s+([A-Z][a-zA-Z\s]+?)(?:\s*\(|,|\.|$)/i) ||
        fullText.match(/\bcast\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s+spell\b/i) ||
        fullText.match(/\bcharges\s+to\s+cast\s+(?:the\s+)?([A-Z][a-zA-Z\s]+?)(?:\s+from|\s+spell|\.|\()/i);
      if (wandSpellMatch) {
        const inferred = wandSpellMatch[1].trim();
        if (!/^(?:Magic|Power|Holding|Healing)$/i.test(inferred) || /Magic\s+Missile/i.test(inferred)) {
          data.spells = [inferred];
        }
      }
    }

    // Auto-infer chargeResetOn & chargeRegeneration if missing/Never
    const fullDesc = `${data.description || ''} ${JSON.stringify(data.features || [])}`;
    if (!data.chargeResetOn || data.chargeResetOn === 'Never') {
      if (/\bdawn\b/i.test(fullDesc)) data.chargeResetOn = 'Dawn';
      else if (/\bdusk\b/i.test(fullDesc)) data.chargeResetOn = 'Dusk';
      else if (/\blong\s+rest\b/i.test(fullDesc)) data.chargeResetOn = 'Long Rest';
      else if (/\bshort\s+rest\b/i.test(fullDesc)) data.chargeResetOn = 'Short Rest';
    }
    if (!data.chargeRegeneration) {
      const regenMatch = fullDesc.match(/(?:regains?|regaining)\s+([^\n.]+?(?:dawn|dusk|long\s+rest|short\s+rest))/i) ||
        fullDesc.match(/([0-9d+\-\s]+expended charges\s+daily\s+at\s+dawn)/i);
      if (regenMatch) {
        data.chargeRegeneration = regenMatch[1].trim();
      }
    }

    // 4. Features & Action Classification
    data.features = Array.isArray(data.features) ? data.features : [];
    const validActionTypes = ['action', 'bonus action', 'reaction', 'special', 'passive'];
    const validAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    data.features = data.features.map((f: any) => {
      if (!f || typeof f !== 'object') return f;

      let actionType = f.actionType;
      if (actionType && typeof actionType === 'string') {
        const aLower = actionType.toLowerCase().trim();
        actionType = validActionTypes.includes(aLower) ? aLower : 'passive';
      } else if (!actionType) {
        const fullDesc = `${f.name || ''} ${f.description || ''}`.toLowerCase();
        if (/\b(?:bonus\s+action)\b/i.test(fullDesc)) {
          actionType = 'bonus action';
        } else if (/\b(?:reaction)\b/i.test(fullDesc)) {
          actionType = 'reaction';
        } else if (/\b(?:magic\s+action|as\s+an\s+action|use\s+an\s+action|take\s+an\s+action)\b/i.test(fullDesc)) {
          actionType = 'action';
        } else {
          actionType = 'passive';
        }
      } else {
        actionType = 'passive';
      }

      let saveDC = f.saveDC;
      if (saveDC !== undefined && saveDC !== null) {
        const parsed = parseInt(String(saveDC), 10);
        saveDC = isNaN(parsed) ? null : parsed;
      } else {
        const fullDesc = `${f.name || ''} ${f.description || ''}`;
        const dcMatch = fullDesc.match(/\bDC\s*(\d+)\b/i);
        saveDC = dcMatch ? parseInt(dcMatch[1], 10) : null;
      }

      let saveAbility = f.saveAbility;
      if (saveAbility && typeof saveAbility === 'string') {
        const abLower = saveAbility.toLowerCase().trim();
        saveAbility = validAbilities.find(a => a.startsWith(abLower.slice(0, 3))) || null;
      } else {
        const fullDesc = `${f.name || ''} ${f.description || ''}`;
        const abMatch = fullDesc.match(/\b(?:DC\s*\d+\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)\s+(?:saving\s+throw|save)\b/i);
        if (abMatch) {
          const abLower = abMatch[1].toLowerCase();
          saveAbility = validAbilities.find(a => a.startsWith(abLower.slice(0, 3))) || null;
        } else {
          saveAbility = null;
        }
      }

      return {
        ...f,
        actionType: actionType || 'passive',
        saveDC: saveDC !== null ? saveDC : null,
        saveAbility: saveAbility || null
      };
    });

    if (data.maxCharges !== undefined) {
      const chg = parseInt(String(data.maxCharges), 10);
      data.maxCharges = isNaN(chg) ? 0 : chg;
    }

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
  }

  /**
   * Species / Race property validation
   */
  private static validateSpeciesProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Species "name" is required');

    tickCheck();
    data.creatureType = data.creatureType || 'Humanoid';
    data.size = data.size || 'Medium';

    tickCheck();
    if (data.baseSpeed !== undefined && data.baseSpeed !== null) {
      const spdInt = parseInt(String(data.baseSpeed).replace(/\D+/g, ''), 10);
      data.baseSpeed = !isNaN(spdInt) ? spdInt : 30;
    } else {
      data.baseSpeed = 30;
    }

    if (data.speed !== undefined && data.speed !== null) {
      const spdNum = typeof data.speed === 'number' ? Math.floor(data.speed) : parseInt(String(data.speed).replace(/\D+/g, ''), 10);
      data.speed = !isNaN(spdNum) ? spdNum : data.baseSpeed;
    } else {
      data.speed = data.baseSpeed;
    }

    tickCheck();
    data.baseLanguages = Array.isArray(data.baseLanguages) ? data.baseLanguages : ['Common'];
    data.features = Array.isArray(data.features) ? data.features : [];
    this.resolveSystem(data, options, coercedFields, tickCheck);

    // Enrich and automate each species feature for character sheet usage
    data.features = data.features.map((f: any) => PropertyValidator.enrichSpeciesFeature(f, coercedFields));

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
  }

  /**
   * Enrich species feature with structured automation fields for character sheet usage
   */
  public static enrichSpeciesFeature(feature: any, coercedFields?: CoercedField[]): any {
    if (!feature || typeof feature !== 'object') return feature;

    const f = { ...feature };
    const rawName = String(f.name || '').trim();
    const rawDesc = String(f.description || '').trim();
    const text = `${rawName} ${rawDesc}`;

    // 1. Ensure id
    if (!f.id || typeof f.id !== 'string') {
      f.id = (rawName || 'trait')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // 2. Ensure descriptionSmall
    if (!f.descriptionSmall && f.description) {
      const firstSentence = f.description.split(/(?<=[.!?])\s+/)[0];
      f.descriptionSmall = firstSentence && firstSentence.length > 5 ? firstSentence : f.description.slice(0, 120);
    }

    // 3. Action Economy (actionType)
    let actionType = f.actionType;
    if (actionType && typeof actionType === 'string') {
      const aLower = actionType.toLowerCase().trim();
      if (['action', 'bonus action', 'reaction', 'passive'].includes(aLower)) {
        actionType = aLower;
      } else {
        actionType = null;
      }
    } else {
      actionType = null;
    }

    if (!actionType) {
      if (/\b(?:bonus\s+action|as\s+a\s+bonus\s+action|use\s+a\s+bonus\s+action|a\s+bonus\s+action\s+to|action\s+as\s+a\s+bonus\s+action)\b/i.test(text)) {
        actionType = 'bonus action';
      } else if (/\b(?:as\s+a\s+reaction|use\s+your\s+reaction)\b/i.test(text)) {
        actionType = 'reaction';
      } else if (/\b(?:as\s+an\s+action|use\s+an\s+action|take\s+an\s+action|as\s+a\s+magic\s+action|action\s+to\s+exhale)\b/i.test(text)) {
        actionType = 'action';
      }
    }
    if (actionType) {
      f.actionType = actionType;
    }

    // 4. Senses & mechanics.senses
    if (/\bdarkvision\b/i.test(text)) {
      const dvMatch =
        text.match(/\b(?:within|range\s+of|out\s+to|up\s+to)\s+(\d+)\s+feet/i) ||
        text.match(/(\d+)\s+feet\s+(?:of\s+)?darkvision/i) ||
        text.match(/darkvision\s*[:\.]?\s*(\d+)\s*ft/i);
      const dvDist = dvMatch ? parseInt(dvMatch[1], 10) : 60;
      f.senses = { ...(f.senses || {}), darkvision: dvDist };
      f.mechanics = { ...(f.mechanics || {}), senses: { ...(f.mechanics?.senses || {}), darkvision: dvDist } };
      f.category = 'Senses';
    }

    if (/\btremorsense\b/i.test(text)) {
      const tsMatch = text.match(/tremorsense\s+(?:with\s+a\s+range\s+of|within|outs+to|of)?\s*(\d+)\s+feet/i);
      const tsDist = tsMatch ? parseInt(tsMatch[1], 10) : 60;
      f.senses = { ...(f.senses || {}), tremorsense: tsDist };
      f.mechanics = { ...(f.mechanics || {}), senses: { ...(f.mechanics?.senses || {}), tremorsense: tsDist } };
    }

    if (/\bblindsight\b/i.test(text)) {
      const bsMatch = text.match(/blindsight\s+(?:with\s+a\s+range\s+of|within|outs+to|of)?\s*(\d+)\s+feet/i);
      const bsDist = bsMatch ? parseInt(bsMatch[1], 10) : 30;
      f.senses = { ...(f.senses || {}), blindsight: bsDist };
      f.mechanics = { ...(f.mechanics || {}), senses: { ...(f.mechanics?.senses || {}), blindsight: bsDist } };
    }

    // 5. Resistances & Immunities
    const damageTypes = [
      'Poison', 'Fire', 'Cold', 'Acid', 'Lightning',
      'Necrotic', 'Radiant', 'Thunder', 'Force', 'Psychic'
    ];
    for (const dmg of damageTypes) {
      if (
        new RegExp(`resistance\\s+to\\s+(?:[A-Za-z]+,\\s*)*${dmg}`, 'i').test(text) ||
        new RegExp(`have\\s+${dmg}\\s+resistance`, 'i').test(text)
      ) {
        const resList = Array.from(new Set([...(f.resistances || []), dmg]));
        f.resistances = resList;
        f.mechanics = {
          ...(f.mechanics || {}),
          resistances: { ...(f.mechanics?.resistances || {}), damageTypes: resList }
        };
        f.category = 'Defense';
      }
      if (new RegExp(`immun(?:e|ity)\\s+to\\s+(?:[A-Za-z]+,\\s*)*${dmg}`, 'i').test(text)) {
        const immList = Array.from(new Set([...(f.immunities || []), dmg]));
        f.immunities = immList;
        f.mechanics = {
          ...(f.mechanics || {}),
          immunities: { ...(f.mechanics?.immunities || {}), damageTypes: immList }
        };
        f.category = 'Defense';
      }
    }

    // 6. Saving throw advantages (e.g. Fey Ancestry -> Charmed, Dwarven Resilience -> Poison, Brave -> Frightened)
    const advSaves: string[] = [];
    if (/advantage\s+on\s+saving\s+throws\s+(?:you\s+make\s+)?to\s+avoid\s+or\s+end\s+the\s+Charmed\s+condition/i.test(text) ||
        /advantage\s+on\s+saving\s+throws\s+against\s+being\s+charmed/i.test(text)) {
      advSaves.push('Charmed');
    }
    if (/advantage\s+on\s+saving\s+throws\s+against\s+poison/i.test(text) ||
        /advantage\s+on\s+saving\s+throws\s+(?:you\s+make\s+)?to\s+avoid\s+or\s+end\s+the\s+Poisoned\s+condition/i.test(text)) {
      advSaves.push('Poison');
    }
    if (/advantage\s+on\s+saving\s+throws\s+(?:you\s+make\s+)?to\s+avoid\s+or\s+end\s+the\s+Frightened\s+condition/i.test(text) ||
        /advantage\s+on\s+saving\s+throws\s+against\s+being\s+frightened/i.test(text)) {
      advSaves.push('Frightened');
    }
    if (/advantage\s+on\s+Intelligence,\s*Wisdom,\s*and\s+Charisma\s+saving\s+throws/i.test(text)) {
      advSaves.push('Intelligence', 'Wisdom', 'Charisma');
    }
    if (advSaves.length > 0) {
      f.mechanics = {
        ...(f.mechanics || {}),
        savingThrowAdvantage: Array.from(new Set([...(f.mechanics?.savingThrowAdvantage || []), ...advSaves]))
      };
      f.category = 'Defense';
    }

    // 7. Proficiencies (Skills & Tools)
    const skillsList = [
      'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
      'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
      'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
      'Sleight of Hand', 'Stealth', 'Survival'
    ];
    for (const sk of skillsList) {
      if (
        new RegExp(`proficiency\\s+in\\s+(?:the\\s+)?${sk}\\s+skill`, 'i').test(text) ||
        new RegExp(`proficient\\s+in\\s+(?:the\\s+)?${sk}`, 'i').test(text)
      ) {
        const skList = Array.from(new Set([...(f.proficiencies?.skills || []), sk]));
        f.proficiencies = { ...(f.proficiencies || {}), skills: skList };
        f.mechanics = {
          ...(f.mechanics || {}),
          proficiencies: { ...(f.mechanics?.proficiencies || {}), skills: skList }
        };
        f.category = 'Skills';
      }
    }

    const toolsList = [
      "Smith's tools", "Brewer's supplies", "Mason's tools", "Artisan's tools",
      "Thieves' tools", "Tinker's tools", "Herbalism kit", "Disguise kit",
      "Poisoner's kit", "Musical instrument"
    ];
    for (const tl of toolsList) {
      const safeRegex = tl.replace("'", "['’]?");
      if (new RegExp(`proficiency\\s+with\\s+(?:the\\s+)?${safeRegex}`, 'i').test(text)) {
        const tlList = Array.from(new Set([...(f.proficiencies?.tools || []), tl]));
        f.proficiencies = { ...(f.proficiencies || {}), tools: tlList };
        f.mechanics = {
          ...(f.mechanics || {}),
          proficiencies: { ...(f.mechanics?.proficiencies || {}), tools: tlList }
        };
      }
    }

    // 8. Skill Choice (globalSkillList)
    const scMatch = text.match(/proficiency\s+in\s+(one|two|1|2)\s+skills?\s+of\s+your\s+choice/i);
    if (scMatch) {
      const count = /two|2/i.test(scMatch[1]) ? 2 : 1;
      f.selectable = true;
      f.requiresChoice = true;
      f.choiceType = 'skill';
      f.speciesWizardPick = 'globalSkillList';
      f.choices = { type: 'Skill', count };
      f.category = 'Skills';
    }

    // 9. Origin Feat Choice
    if (/(?:gain|choose)\s+(?:one|1)?\s*Origin\s+feat\s+of\s+your\s+choice/i.test(text)) {
      f.selectable = true;
      f.requiresChoice = true;
      f.choiceType = 'feat';
      f.featFilter = { featType: 'Origin' };
    }

    // 10. Lineages / Subspecies choices
    const lineageMatch =
      text.match(/(?:Choose\s+(?:a|an|your)\s+(?:lineage|ancestry|dragon\s+ancestor|giant\s+ancestry|subrace|legacy|subspecies)|Lineage\s+Options|Subrace\s+Options)\s*[:\.]?\s*([^.\n]+)/i);
    if (lineageMatch) {
      const rawOptions = lineageMatch[1]
        .replace(/,?\s+or\s+/i, ', ')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (rawOptions.length >= 2) {
        f.selectable = true;
        f.requiresChoice = true;
        f.speciesWizardPick = 'lineagePick';
        f.options = rawOptions.map((opt: string) => ({
          id: opt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          name: opt,
          description: ''
        }));
        f.choices = { type: 'Custom', count: 1, options: rawOptions };
      }
    }

    // 11. Usage Limits & Resource Strip (maxUses, usesResetOn, sheetResourceStrip)
    if (/(?:number\s+of\s+times\s+equal\s+to\s+your\s+Proficiency\s+Bonus|times\s+equal\s+to\s+your\s+PB)/i.test(text)) {
      f.maxUses = { type: 'proficiencyBonus' };
      f.sheetResourceStrip = { enabled: true };
    }
    if (
      /regain\s+all\s+expended\s+uses\s+when\s+you\s+finish\s+a\s+Long\s+Rest/i.test(text) ||
      /finish\s+a\s+Long\s+Rest\s+before\s+you\s+can\s+use\s+it\s+again/i.test(text) ||
      /Once\s+per\s+Long\s+Rest/i.test(text)
    ) {
      f.usesResetOn = 'long rest';
      if (!f.maxUses) f.maxUses = 1;
      f.usageLimits = { type: 'Long Rest', amount: typeof f.maxUses === 'number' ? f.maxUses : 1 };
      f.sheetResourceStrip = { enabled: true };
    } else if (/regain\s+all\s+expended\s+uses\s+when\s+you\s+finish\s+a\s+Short\s+or\s+Long\s+Rest/i.test(text)) {
      f.usesResetOn = 'short rest';
      if (!f.maxUses) f.maxUses = 1;
      f.usageLimits = { type: 'Short Rest', amount: typeof f.maxUses === 'number' ? f.maxUses : 1 };
      f.sheetResourceStrip = { enabled: true };
    }

    // 12. Spells & Cantrips
    const splChoiceMatch = text.match(/cantrip\s+of\s+your\s+choice\s+from\s+the\s+(Wizard|Druid|Cleric|Sorcerer|Bard)\s+spell\s+list/i);
    if (splChoiceMatch) {
      f.spellChoice = { count: 1, level: 0, spellList: splChoiceMatch[1] };
      f.category = 'Spellcasting';
    }
    const knownCantrips = [
      'Thaumaturgy', 'Light', 'Produce Flame', 'Druidcraft', 'Prestidigitation',
      'Guidance', 'Sacred Flame', 'Minor Illusion', 'Message', 'Ray of Frost',
      'Chill Touch', 'Shocking Grasp', 'Vicious Mockery', 'Blade Ward', 'Friends',
      'Mending', 'Fire Bolt', 'Poison Spray', 'Dancing Lights', 'Spare the Dying',
      'True Strike', 'Shillelagh', 'Resistance', 'Acid Splash'
    ];
    for (const cantrip of knownCantrips) {
      const safeC = cantrip.replace("'", "['’]?");
      if (
        new RegExp(`(?:know|gain|learn)\\s+(?:the\\s+)?${safeC}\\s+cantrip`, 'i').test(text) ||
        new RegExp(`the\\s+${safeC}\\s+cantrip\\s+is\\s+always\\s+prepared`, 'i').test(text)
      ) {
        f.atWillSpell = cantrip;
        f.atWillRecharge = 'atWill';
        f.category = 'Spellcasting';
        break;
      }
    }

    // 13. Natural Weapons / Unarmed Strike
    if (/\b(?:claws?|talons?|horns?|hooves|bite)\b/i.test(text) && /\b(?:1d6|1d4)\b/i.test(text) && /\bunarmed\s+strikes?\b/i.test(text)) {
      const dieMatch = text.match(/\b(1d[468])\b/i);
      const die = dieMatch ? dieMatch[1].toLowerCase() : '1d6';
      f.unarmedStrike = { die, useMaxStatModifier: true };
      f.category = 'Combat';
    }

    // 14. Movement Speeds
    if (/\bflying\s+speed\s+(?:equal\s+to\s+your\s+walking\s+speed|of\s*(\d+)\s*feet)/i.test(text)) {
      const flyMatch = text.match(/flying\s+speed\s+of\s*(\d+)\s*feet/i);
      const flySpeed = flyMatch ? parseInt(flyMatch[1], 10) : 30;
      f.movement = { ...(f.movement || {}), fly: flySpeed };
    }
    if (/\bswimming\s+speed\s+(?:equal\s+to\s+your\s+walking\s+speed|of\s*(\d+)\s*feet)/i.test(text)) {
      const swimMatch = text.match(/swimming\s+speed\s+of\s*(\d+)\s*feet/i);
      const swimSpeed = swimMatch ? parseInt(swimMatch[1], 10) : 30;
      f.movement = { ...(f.movement || {}), swim: swimSpeed };
    }
    if (/\bclimbing\s+speed\s+(?:equal\s+to\s+your\s+walking\s+speed|of\s*(\d+)\s*feet)/i.test(text)) {
      const climbMatch = text.match(/climbing\s+speed\s+of\s*(\d+)\s*feet/i);
      const climbSpeed = climbMatch ? parseInt(climbMatch[1], 10) : 30;
      f.movement = { ...(f.movement || {}), climb: climbSpeed };
    }

    // 15. Category Fallback
    if (!f.category || f.category === 'Racial Trait' || f.category === 'Passive' || f.category === 'Active') {
      if (/\b(?:darkvision|blindsight|tremorsense|truesight|senses)\b/i.test(text)) {
        f.category = 'Senses';
      } else if (/\b(?:resilience|resistance|ancestry|toughness|armor|defense|ward|immunity|saving\s+throw)\b/i.test(text)) {
        f.category = 'Defense';
      } else if (/\b(?:perception|stealth|skill|versatility|skillful|keen\s+senses)\b/i.test(text)) {
        f.category = 'Skills';
      } else if (/\b(?:magic|cantrip|spell|casting|drow\s+magic)\b/i.test(text)) {
        f.category = 'Spellcasting';
      } else if (/\b(?:strike|attack|weapon|fury|breath\s+weapon)\b/i.test(text)) {
        f.category = 'Combat';
      } else {
        f.category = f.category || 'Racial Trait';
      }
    }

    return f;
  }

  private static validateClassProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Class "name" is required');

    tickCheck();
    if (!data.traits || typeof data.traits !== 'object') data.traits = {};

    // 1. hitDie
    if (data.hitDie && typeof data.hitDie === 'string' && data.hitDie !== '1d8') {
      data.traits.hitDie = data.hitDie;
    } else if (data.traits.hitDie && typeof data.traits.hitDie === 'string' && data.traits.hitDie !== '1d8') {
      data.hitDie = data.traits.hitDie;
    } else {
      const fullText = `${data.description || ''} ${JSON.stringify(data.features || [])} ${data.startingEquipment || ''} ${JSON.stringify(data.traits || {})}`;
      const hdMatch =
        fullText.match(/Hit\s+Dice:\s*(\d*d\d+)/i) ||
        fullText.match(/Hit\s+(?:Point\s+)?(?:Die|Dice)\s*:\s*(\d*d\d+)/i) ||
        fullText.match(/(?:Hit Point Die|Hit Point Dice|Hit Die|Hit Dice)\s*:\s*(?:1?d\d+|d\d+)/i);
      if (hdMatch) {
        const raw = hdMatch[1] || hdMatch[0];
        const matchHd = raw.match(/1?d(4|6|8|10|12)/i);
        const resolved = matchHd ? (matchHd[0].startsWith('1') ? matchHd[0] : `1${matchHd[0]}`) : '1d8';
        data.hitDie = resolved;
        data.traits.hitDie = resolved;
      } else {
        data.hitDie = data.hitDie || data.traits.hitDie || '1d8';
        data.traits.hitDie = data.hitDie;
      }
    }

    // 2. primaryAbility
    if (data.primaryAbility) {
      if (Array.isArray(data.primaryAbility)) {
        data.traits.primaryAbility = data.primaryAbility;
        data.primaryAbility = data.primaryAbility[0] || 'Strength';
      } else {
        data.traits.primaryAbility = [String(data.primaryAbility)];
        data.primaryAbility = String(data.primaryAbility);
      }
    } else if (Array.isArray(data.traits.primaryAbility) && data.traits.primaryAbility.length > 0) {
      data.primaryAbility = data.traits.primaryAbility[0];
    } else {
      data.primaryAbility = 'Strength';
      data.traits.primaryAbility = ['Strength'];
    }

    // 3. savingThrowProficiency
    if (Array.isArray(data.savingThrowProficiency)) {
      data.traits.savingThrowProficiencies = data.savingThrowProficiency;
    } else if (Array.isArray(data.traits.savingThrowProficiencies)) {
      data.savingThrowProficiency = data.traits.savingThrowProficiencies;
    } else {
      data.savingThrowProficiency = [];
      data.traits.savingThrowProficiencies = [];
    }

    // 4. armorProficiency
    if (Array.isArray(data.armorProficiency)) {
      data.traits.armorProficiencies = data.armorProficiency;
    } else if (Array.isArray(data.traits.armorProficiencies)) {
      data.armorProficiency = data.traits.armorProficiencies;
    } else {
      data.armorProficiency = [];
      data.traits.armorProficiencies = [];
    }

    // 5. weaponProficiency
    if (Array.isArray(data.weaponProficiency)) {
      data.traits.weaponProficiencies = data.weaponProficiency;
    } else if (Array.isArray(data.traits.weaponProficiencies)) {
      data.weaponProficiency = data.traits.weaponProficiencies;
    } else {
      data.weaponProficiency = [];
      data.traits.weaponProficiencies = [];
    }

    // 6. toolProficiency
    if (Array.isArray(data.toolProficiency)) {
      data.traits.toolProficiencies = data.toolProficiency;
    } else if (Array.isArray(data.traits.toolProficiencies)) {
      data.toolProficiency = data.traits.toolProficiencies;
    } else {
      data.toolProficiency = [];
      data.traits.toolProficiencies = [];
    }

    // 7. skillProficiency
    if (Array.isArray(data.skillProficiency)) {
      data.traits.skillProficiencies = { choose: 2, from: data.skillProficiency };
    } else if (data.traits.skillProficiencies && Array.isArray(data.traits.skillProficiencies.from)) {
      data.skillProficiency = data.traits.skillProficiencies.from;
    } else if (!Array.isArray(data.skillProficiency)) {
      data.skillProficiency = [];
    }

    // 8. features: extract from levelProgression if missing
    if (!Array.isArray(data.features) || data.features.length === 0) {
      if (Array.isArray(data.levelProgression)) {
        const flattened: any[] = [];
        for (const lp of data.levelProgression) {
          if (Array.isArray(lp.features)) {
            for (const feat of lp.features) {
              flattened.push({
                ...feat,
                classLevel: feat.classLevel || lp.level || 1
              });
            }
          }
        }
        data.features = flattened;
      } else {
        data.features = [];
      }
    }

    tickCheck();
    if (!data.spellcasting || typeof data.spellcasting !== 'object') {
      data.spellcasting = { spellcastingType: 'none', spellcastingAbility: null };
    }

    tickCheck();
    data.levelProgression = Array.isArray(data.levelProgression) ? data.levelProgression : [];
    this.resolveSystem(data, options, coercedFields, tickCheck);

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'flavorText'], tickCheck);
  }

  /**
   * Subclass property validation
   */
  private static validateSubclassProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Subclass "name" is required');

    tickCheck();
    if (!data.className || typeof data.className !== 'string') {
      warnings.push('Subclass "className" should reference parent class (e.g. Fighter)');
      data.className = data.className || 'Fighter';
    }

    tickCheck();
    if (!data.classId || typeof data.classId !== 'string') {
      data.classId = data.className || 'Fighter';
    }

    tickCheck();
    this.resolveSystem(data, options, coercedFields, tickCheck);

    // 1. Subclass Proficiencies (traits)
    if (!data.traits || typeof data.traits !== 'object') {
      data.traits = {};
    }
    data.traits.armorProficiencies = Array.isArray(data.traits.armorProficiencies)
      ? data.traits.armorProficiencies
      : [];
    data.traits.weaponProficiencies = Array.isArray(data.traits.weaponProficiencies)
      ? data.traits.weaponProficiencies
      : [];
    data.traits.toolProficiencies = Array.isArray(data.traits.toolProficiencies)
      ? data.traits.toolProficiencies
      : [];
    data.traits.savingThrowProficiencies = Array.isArray(data.traits.savingThrowProficiencies)
      ? data.traits.savingThrowProficiencies
      : [];

    const fullText = `${data.name || ''} ${data.description || ''} ${JSON.stringify(data.features || [])}`;

    const addUnique = (arr: string[], item: string) => {
      if (!arr.some(x => x.toLowerCase() === item.toLowerCase())) {
        arr.push(item);
      }
    };

    if (/\bheavy\s+armor\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.armorProficiencies, 'Heavy armor');
    }
    if (/\bmedium\s+armor\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.armorProficiencies, 'Medium armor');
    }
    if (/\blight\s+armor\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.armorProficiencies, 'Light armor');
    }
    if (/\bshields?\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.armorProficiencies, 'Shields');
    }

    if (/\bmartial\s+weapons?\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.weaponProficiencies, 'Martial weapons');
    }
    if (/\bsimple\s+weapons?\b/i.test(fullText) && /\b(?:proficiency|proficient|training)\b/i.test(fullText)) {
      addUnique(data.traits.weaponProficiencies, 'Simple weapons');
    }

    if (/\bartisan['’]s\s+tools?\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, "Artisan's tools");
    }
    if (/\bdisguise\s+kit\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, 'Disguise kit');
    }
    if (/\bpoisoner['’]s\s+kit\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, "Poisoner's kit");
    }
    if (/\bthieves['’]\s+tools\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, "Thieves' tools");
    }
    if (/\bmusical\s+instruments?\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, 'Musical instrument');
    }
    if (/\bherbalism\s+kit\b/i.test(fullText)) {
      addUnique(data.traits.toolProficiencies, 'Herbalism kit');
    }

    const stMatch = fullText.match(/proficiency\s+in\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throws/i);
    if (stMatch) {
      addUnique(data.traits.savingThrowProficiencies, stMatch[1]);
    }

    // 2. Features Level Fallback (Kickoff Level 3) & Action Economy Classification
    data.features = (Array.isArray(data.features) ? data.features : []).map((f: any) => {
      if (!f || typeof f !== 'object') return f;

      let lvl: number | null = null;
      if (typeof f.level === 'number' && !isNaN(f.level) && f.level > 0) {
        lvl = f.level;
      } else if (typeof f.level === 'string') {
        const p = parseInt(f.level, 10);
        if (!isNaN(p) && p > 0) lvl = p;
      }
      if (!lvl) {
        const text = `${f.name || ''} ${f.description || ''}`;
        const lvlMatch =
          text.match(/(?:At|Starting\s+at|by)\s+(\d+)(?:st|nd|rd|th)?\s+level/i) ||
          text.match(/\b(\d+)(?:st|nd|rd|th)[- ]level\b/i);
        if (lvlMatch) {
          lvl = parseInt(lvlMatch[1], 10);
        }
      }

      let actionType = f.actionType;
      if (actionType && typeof actionType === 'string') {
        const aLower = actionType.toLowerCase().trim();
        if (['action', 'bonus action', 'reaction', 'passive'].includes(aLower)) {
          actionType = aLower;
        } else {
          actionType = null;
        }
      } else {
        actionType = null;
      }

      if (!actionType) {
        const text = `${f.name || ''} ${f.description || ''}`.toLowerCase();
        if (/\b(?:bonus\s+action|as\s+a\s+bonus\s+action|use\s+a\s+bonus\s+action|a\s+bonus\s+action\s+to)\b/i.test(text)) {
          actionType = 'bonus action';
        } else if (/\b(?:reaction|as\s+a\s+reaction|use\s+your\s+reaction)\b/i.test(text)) {
          actionType = 'reaction';
        } else if (/\b(?:as\s+an\s+action|use\s+an\s+action|take\s+an\s+action|as\s+a\s+magic\s+action|action\s+to)\b/i.test(text)) {
          actionType = 'action';
        } else {
          actionType = 'passive';
        }
      }

      return {
        ...f,
        level: lvl || 3,
        actionType
      };
    });

    // 3. Maneuver Subclasses (e.g. Battle Master)
    const isManeuver =
      /battle\s*master/i.test(data.name || '') ||
      /\b(?:combat\s+superiority|superiority\s+dice|maneuver\s+options?|list\s+of\s+maneuvers)\b/i.test(fullText);
    if (isManeuver) {
      if (!data.subclassManeuverPackTag) {
        data.subclassManeuverPackTag = 'battle-master';
      }
      if (!data.superiorityDiceType) {
        const diceMatch = fullText.match(/\b(?:die\s+is\s+a|dice\s+are)\s+(d[468]|d1[02])\b/i);
        data.superiorityDiceType = diceMatch ? diceMatch[1].toLowerCase() : 'd8';
      }
    }

    // 4. Subclass Spellcasting (e.g. Eldritch Knight, Arcane Trickster)
    const isEldritchKnight = /eldritch\s+knight/i.test(data.name || '');
    const isArcaneTrickster = /arcane\s+trickster/i.test(data.name || '');
    const className = String(data.className || '').toLowerCase();
    const isNonCaster = ['fighter', 'rogue', 'barbarian', 'monk'].includes(className);
    const hasSpellcasting =
      isEldritchKnight ||
      isArcaneTrickster ||
      (isNonCaster && /\bSpellcasting\b/i.test(fullText) && /\b(?:spell\s+slots|cantrips?)\b/i.test(fullText));

    if (hasSpellcasting) {
      if (!data.spellcasting || typeof data.spellcasting !== 'object') {
        data.spellcasting = {};
      }
      let ability = data.spellcasting.spellcastingAbility;
      if (!ability) {
        if (/\bWisdom\s+is\s+your\s+spellcasting\s+ability\b/i.test(fullText)) {
          ability = 'Wisdom';
        } else if (/\bCharisma\s+is\s+your\s+spellcasting\s+ability\b/i.test(fullText)) {
          ability = 'Charisma';
        } else {
          ability = 'Intelligence';
        }
      }
      data.spellcasting.spellcastingAbility = ability;
      data.spellcasting.spellcastingType = data.spellcasting.spellcastingType || 'known';
    }

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
  }

  /**
   * Feat property validation
   */
  private static validateFeatProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Feat "name" is required');

    tickCheck();
    const validFeatTypes = ['Origin', 'General', 'Fighting Style', 'Epic Boon'];
    if (data.featType && typeof data.featType === 'string') {
      const match = validFeatTypes.find(t => t.toLowerCase() === data.featType.toLowerCase());
      if (match) data.featType = match;
    } else {
      data.featType = 'General';
    }

    tickCheck();
    if (data.preRequisite !== undefined && data.prerequisite === undefined) {
      data.prerequisite = data.preRequisite;
      delete data.preRequisite;
    }
    data.prerequisite = data.prerequisite || 'None';
    data.repeatable = Boolean(data.repeatable);
    data.features = Array.isArray(data.features) ? data.features : [];

    // Ensure non-empty description (synthesizing from features or benefit overview if source jumps directly to benefits)
    tickCheck();
    const rawDesc = typeof data.description === 'string' ? data.description.trim() : '';
    if (!rawDesc) {
      const featureNames = data.features.map((f: any) => f?.name).filter(Boolean);
      const synthesizedDesc = featureNames.length > 0
        ? `You gain the following benefits: ${featureNames.join(', ')}.`
        : 'You gain the following benefits:';
      coercedFields.push({
        path: 'description',
        original: data.description,
        coerced: synthesizedDesc,
        reason: 'Synthesized non-empty feat description from features for schema compliance'
      });
      data.description = synthesizedDesc;
    } else {
      data.description = rawDesc;
    }

    if (data.translations && typeof data.translations === 'object') {
      for (const [locKey, loc] of Object.entries(data.translations) as [string, any][]) {
        if (loc && typeof loc === 'object') {
          if (loc.preRequisite !== undefined) {
            if (loc.prerequisite === undefined) {
              loc.prerequisite = loc.preRequisite;
            }
            delete loc.preRequisite;
          }
          const rawLocDesc = typeof loc.description === 'string' ? loc.description.trim() : '';
          if (!rawLocDesc) {
            const locFeatureNames = Array.isArray(loc.features)
              ? loc.features.map((f: any) => f?.name).filter(Boolean)
              : [];
            const isPt = locKey.toLowerCase().startsWith('pt');
            const fallbackPrefix = isPt ? 'Você recebe os seguintes benefícios' : 'You gain the following benefits';
            loc.description = locFeatureNames.length > 0
              ? `${fallbackPrefix}: ${locFeatureNames.join(', ')}.`
              : `${fallbackPrefix}:`;
          } else {
            loc.description = rawLocDesc;
          }
        }
      }
    }

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.resolveSystem(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features', 'featType', 'prerequisite'], tickCheck);
  }

  /**
   * Background property validation
   */
  private static validateBackgroundProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Background "name" is required');

    tickCheck();
    if (!data.feat || typeof data.feat !== 'string') {
      data.feat = 'Savage Attacker';
      coercedFields.push({
        path: 'feat',
        original: undefined,
        coerced: 'Savage Attacker',
        reason: 'Defaulted feat name for background relational tie-in'
      });
    }

    tickCheck();
    data.abilityScoreIncrease = Array.isArray(data.abilityScoreIncrease) ? data.abilityScoreIncrease : [];
    data.skillProficiency = Array.isArray(data.skillProficiency) ? data.skillProficiency : [];
    data.toolProficiency = Array.isArray(data.toolProficiency) ? data.toolProficiency : [];
    data.equipment = Array.isArray(data.equipment) ? data.equipment : [];
    data.features = Array.isArray(data.features) ? data.features : [];
    this.resolveSystem(data, options, coercedFields, tickCheck);

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
  }

  /**
   * Weapon property validation
   */
  private static validateWeaponProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Weapon "name" is required');

    tickCheck();
    data.category = data.category || 'Simple Melee Weapons';
    data.damage = data.damage || '1d6';
    data.damageType = (data.damageType || 'slashing').toLowerCase();

    // Sanitize mixed damage strings e.g. "1d4 piercing" or "2d6 slashing"
    const dmgParts = String(data.damage).match(/^(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([a-zA-Z]+)?$/i);
    if (dmgParts) {
      data.damage = dmgParts[1].trim();
      if (dmgParts[2] && (!data.damageType || data.damageType === 'slashing')) {
        data.damageType = dmgParts[2].toLowerCase().trim();
      }
    }

    tickCheck();
    if (data.weight !== undefined) {
      const wt = parseFloat(String(data.weight));
      data.weight = isNaN(wt) ? 1 : wt;
    } else {
      data.weight = 1;
    }

    if (data.cost !== undefined) {
      const c = parseFloat(String(data.cost));
      data.cost = isNaN(c) ? 0 : c;
    }

    tickCheck();
    data.properties = Array.isArray(data.properties) ? data.properties : [];

    // Coerce singular mastery into masteries array if present
    if (data.mastery && (!data.masteries || data.masteries.length === 0)) {
      data.masteries = [String(data.mastery).trim()];
    }
    data.masteries = Array.isArray(data.masteries) ? data.masteries : [];

    // Description fallback
    if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
      data.description = `Proficiency with a ${data.name} allows you to add your proficiency bonus to the attack roll for any attack you make with it.`;
    }

    data.type = data.isMagical ? 'magic-weapon' : 'weapon';
    data.isMagical = Boolean(data.isMagical);
    data.edition = data.edition || '2024';
    this.resolveSystem(data, options, coercedFields, tickCheck);

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description'], tickCheck);
  }

  /**
   * Armor and Shield property validation
   */
  private static validateArmorProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Armor "name" is required');

    tickCheck();
    const validArmorTypes = ['Light', 'Medium', 'Heavy', 'Shield'];
    const matchedType = validArmorTypes.find(t => t.toLowerCase() === String(data.armorType || '').toLowerCase());
    data.armorType = matchedType || (String(data.name).toLowerCase().includes('shield') ? 'Shield' : 'Medium');

    tickCheck();
    if (data.armorClass === undefined && data.ac !== undefined) {
      data.armorClass = String(data.ac);
    }
    data.armorClass = data.armorClass !== undefined ? String(data.armorClass) : (data.armorType === 'Shield' ? '2' : '10 + Dex');

    tickCheck();
    if (data.strengthRequirement !== undefined && data.strengthRequirement !== null) {
      const str = parseInt(String(data.strengthRequirement), 10);
      data.strengthRequirement = isNaN(str) || str <= 0 ? undefined : str;
    }

    data.stealthDisadvantage = Boolean(data.stealthDisadvantage);

    tickCheck();
    if (data.weight !== undefined) {
      const wt = parseFloat(String(data.weight));
      data.weight = isNaN(wt) ? 1 : wt;
    } else {
      data.weight = data.armorType === 'Shield' ? 6 : 20;
    }

    if (data.cost !== undefined) {
      const c = parseFloat(String(data.cost));
      data.cost = isNaN(c) ? 0 : c;
    }

    data.description = typeof data.description === 'string' ? data.description : '';
    data.type = data.isMagical ? 'magic-armor' : 'armor';
    data.isMagical = Boolean(data.isMagical);
    data.edition = data.edition || '2024';
    this.resolveSystem(data, options, coercedFields, tickCheck);

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description'], tickCheck);
  }

  /**
   * General non-magical item and adventuring gear validation
   */
  private static validateItemProperties(
    data: any,
    targetSchema: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (!data.name || typeof data.name !== 'string') errors.push('Item "name" is required');

    tickCheck();
    data.type = 'equipment';

    const validEntityTypes = [
      'tool', 'kit', 'utility', 'camping-gear', 'clothing',
      'light-source', 'container', 'instrument', 'game',
      'adventuring-gear', 'food-drink', 'transport', 'other'
    ];
    let entityType = String(data.entityType || '').toLowerCase().trim();
    if (!validEntityTypes.includes(entityType)) {
      const lowerName = String(data.name || '').toLowerCase();
      if (lowerName.includes('tool') || lowerName.includes('kit') || lowerName.includes('supplies')) {
        entityType = 'tool';
      } else if (lowerName.includes('rope') || lowerName.includes('chain') || lowerName.includes('ladder') || lowerName.includes('crowbar') || lowerName.includes('grappling')) {
        entityType = 'utility';
      } else if (lowerName.includes('tent') || lowerName.includes('bedroll') || lowerName.includes('blanket')) {
        entityType = 'camping-gear';
      } else if (lowerName.includes('game') || lowerName.includes('dice') || lowerName.includes('cards') || lowerName.includes('chess')) {
        entityType = 'game';
      } else if (lowerName.includes('oil') || lowerName.includes('torch') || lowerName.includes('lantern') || lowerName.includes('candle') || lowerName.includes('lamp')) {
        entityType = 'light-source';
      } else if (lowerName.includes('clothing') || lowerName.includes('robes') || lowerName.includes('clothes') || lowerName.includes('costume')) {
        entityType = 'clothing';
      } else if (lowerName.includes('food') || lowerName.includes('rations') || lowerName.includes('meal') || lowerName.includes('water')) {
        entityType = 'food-drink';
      } else if (lowerName.includes('component pouch') || lowerName.includes('focus') || lowerName.includes('holy symbol') || lowerName.includes('pack') || lowerName.includes('backpack')) {
        entityType = 'adventuring-gear';
      } else if (lowerName.includes('bag') || lowerName.includes('chest') || lowerName.includes('barrel') || lowerName.includes('basket') || lowerName.includes('pouch') || lowerName.includes('sack')) {
        entityType = 'container';
      } else if (lowerName.includes('flute') || lowerName.includes('drum') || lowerName.includes('lute') || lowerName.includes('horn') || lowerName.includes('pipe') || lowerName.includes('lyre')) {
        entityType = 'instrument';
      } else if (lowerName.includes('ship') || lowerName.includes('boat') || lowerName.includes('cart') || lowerName.includes('wagon') || lowerName.includes('carriage') || lowerName.includes('saddle')) {
        entityType = 'transport';
      } else {
        entityType = 'adventuring-gear';
      }
    }
    data.entityType = entityType;

    if (data.cost !== undefined && data.cost !== null) {
      data.cost = String(data.cost);
    }
    if (data.weight !== undefined && data.weight !== null) {
      data.weight = String(data.weight);
    }

    data.description = typeof data.description === 'string' ? data.description : '';
    data.edition = data.edition || '2024';
    this.resolveSystem(data, options, coercedFields, tickCheck);

    delete data.rarity;
    delete data.attunement;

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description'], tickCheck);
  }

  /**
   * Resolves the "system" and "edition" fields:
   * 1. If options.system is passed in the request body, strictly echoes/normalizes that value.
   * 2. If options.defaults?.system is passed, echoes that value.
   * 3. Detects 2024 content via options.edition === '2024', data.edition === '2024',
   *    or 2024 book references in books array (e.g. "Player's Handbook 2024", "Monster Manual 2024").
   *    In 2024 context, legacy strings ("dnd5e", "5e", "D&D 5e") and 5.5e aliases are normalized to "D&D 5.5e".
   * 4. For 2014 content (edition: '2014' in data or options), defaults to 'D&D 5e (2014)'.
   * 5. Otherwise for 2024 content (default in this service), defaults strictly to 'D&D 5.5e'.
   */
  public static resolveSystem(
    data: any,
    options: NormalizeOptions,
    coercedFields?: CoercedField[],
    tickCheck?: () => void
  ): void {
    if (tickCheck) tickCheck();

    // 1. Check for explicit system requested in options or defaults
    const requestedSystem =
      (typeof options.system === 'string' && options.system.trim()) ||
      (typeof options.defaults?.system === 'string' && options.defaults.system.trim()) ||
      undefined;

    // 2. Check for explicit edition requested in options, defaults, or data
    const requestedEdition =
      (typeof options.edition === 'string' && options.edition.trim()) ||
      (typeof options.defaults?.edition === 'string' && options.defaults.edition.trim()) ||
      (typeof data.edition === 'string' && data.edition.trim()) ||
      undefined;

    // 3. Inspect book references in data.books and options.defaults.books
    const allBooks: string[] = [
      ...(Array.isArray(data.books) ? data.books : []),
      ...(Array.isArray(options.defaults?.books) ? options.defaults.books : [])
    ].map(b => (typeof b === 'string' ? b : '')).filter(Boolean);

    const has2024Book = allBooks.some(b => /2024|5\.5/i.test(b));
    const has2014Book = allBooks.some(b => /2014/i.test(b));

    const isExplicit2014 =
      Boolean(requestedEdition && /2014/i.test(requestedEdition)) ||
      Boolean(requestedSystem && /2014/i.test(requestedSystem));

    const isExplicit2024 =
      Boolean(requestedEdition && /2024|5\.5/i.test(requestedEdition)) ||
      Boolean(requestedSystem && /5\.5|2024/i.test(requestedSystem));

    const is2014Requested = isExplicit2014 || (!isExplicit2024 && has2014Book && !has2024Book);
    const is2024Requested = !is2014Requested;

    // Determine final edition
    const edition = is2014Requested ? '2014' : (requestedEdition || '2024');
    data.edition = edition;

    const originalSystem = data.system;
    let resolvedSystem: string;

    if (requestedSystem) {
      if (/^(?:5\.5e?|dnd\s*5\.5e?|d&d\s*5\.5e?|d&d\s*2024|5e-?2024)$/i.test(requestedSystem)) {
        resolvedSystem = 'D&D 5.5e';
      } else {
        resolvedSystem = requestedSystem;
      }
    } else if (is2014Requested) {
      resolvedSystem = 'D&D 5e (2014)';
    } else {
      // Default / 2024 mode:
      const currentSys = typeof data.system === 'string' ? data.system.trim() : '';
      const isLegacy5e = /^(?:dnd5e|dnd\s*5e|5e|d&d\s*5e|d&d\s*5th\s*edition|5th\s*edition|d&d\s*5e\s*\(2014\))$/i.test(currentSys);
      const is55Variant = /^(?:5\.5e?|dnd\s*5\.5e?|d&d\s*5\.5e?|d&d\s*2024|5e-?2024)$/i.test(currentSys);

      if (!currentSys || isLegacy5e || is55Variant) {
        resolvedSystem = 'D&D 5.5e';
      } else {
        resolvedSystem = currentSys;
      }
    }

    if (originalSystem !== resolvedSystem) {
      if (coercedFields && originalSystem !== undefined) {
        coercedFields.push({
          path: 'system',
          original: originalSystem,
          coerced: resolvedSystem,
          reason: 'Normalized system to edition naming convention'
        });
      }
      data.system = resolvedSystem;
    }
  }

  private static ensureBooksArray(
    data: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    tickCheck: () => void
  ) {
    tickCheck();
    const is2014 = options.edition === '2014' || data.edition === '2014' || (typeof options.system === 'string' && /2014/i.test(options.system));
    const defaultBook = options.defaults?.books?.[0] || (is2014
      ? (options.template === 'monster' ? 'Monster Manual (2014)' : "Player's Handbook (2014)")
      : (options.template === 'monster' ? 'Monster Manual 2024' : "Player's Handbook 2024"));
    if (!Array.isArray(data.books) || data.books.length === 0) {
      data.books = [defaultBook];
      coercedFields.push({
        path: 'books',
        original: data.books,
        coerced: [defaultBook],
        reason: 'Assigned default book reference'
      });
    } else {
      // Preserve both human-readable book names (e.g. "Player's Handbook 2024") and MongoDB ObjectIds
      data.books = data.books.map((b: any) => (typeof b === 'string' && b.trim() ? b.trim() : defaultBook));
    }
  }

  private static ensureEmbeddedTranslation(
    data: any,
    options: NormalizeOptions,
    copyFields: string[],
    tickCheck: () => void
  ) {
    tickCheck();
    if (options.targetLocale || (data.translations && Object.keys(data.translations).length > 0)) {
      const locale = options.targetLocale || Object.keys(data.translations)[0];
      if (!data.translations) data.translations = {};
      if (!data.translations[locale]) data.translations[locale] = {};

      const loc = data.translations[locale];
      for (const field of copyFields) {
        if (loc[field] === undefined && data[field] !== undefined) {
          loc[field] = data[field];
        }
      }

      if (!loc._metadata) {
        loc._metadata = {
          locale,
          translatedAt: new Date().toISOString(),
          source: 'AI_TRANSLATION',
          quality: 'DRAFT'
        };
      }
      if (!loc.metadata) {
        loc.metadata = {
          reviewed: false,
          translatedBy: 'ai'
        };
      }
    }
  }

  /**
   * Generic property checks against any arbitrary target schema
   */
  private static validateGenericProperties(
    data: any,
    targetSchema: any,
    coercedFields: CoercedField[],
    warnings: string[],
    errors: string[],
    tickCheck: () => void
  ) {
    for (const [key, expectedVal] of Object.entries(targetSchema)) {
      tickCheck();
      const currentVal = data[key];

      if (currentVal === undefined) {
        data[key] = expectedVal;
        coercedFields.push({
          path: key,
          original: undefined,
          coerced: expectedVal,
          reason: 'Applied missing schema property default'
        });
        continue;
      }

      // Type checks and coercions
      const expectedType = Array.isArray(expectedVal) ? 'array' : typeof expectedVal;
      const actualType = Array.isArray(currentVal) ? 'array' : typeof currentVal;

      if (expectedType === 'number' && actualType !== 'number') {
        const num = Number(currentVal);
        if (!isNaN(num)) {
          coercedFields.push({
            path: key,
            original: currentVal,
            coerced: num,
            reason: 'Coerced string to number'
          });
          data[key] = num;
        } else {
          errors.push(`Property "${key}" expected number, got ${typeof currentVal} ("${currentVal}")`);
        }
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        const b = currentVal === 'true' || currentVal === 1 || currentVal === true;
        coercedFields.push({
          path: key,
          original: currentVal,
          coerced: b,
          reason: 'Coerced to boolean'
        });
        data[key] = b;
      } else if (expectedType === 'array' && actualType !== 'array') {
        data[key] = [currentVal];
        coercedFields.push({
          path: key,
          original: currentVal,
          coerced: data[key],
          reason: 'Wrapped single value in array'
        });
      }
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
  }

  private static setNestedValue(obj: any, path: string, val: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    let current = obj;
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[last] = val;
  }
}
