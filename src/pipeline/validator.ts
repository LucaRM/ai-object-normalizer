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
    if (tmpl === 'monster' || (targetSchema && (targetSchema.armorClass !== undefined || targetSchema.challengeRating !== undefined))) {
      this.validateMonsterProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'spell' || (targetSchema && targetSchema.castingAction !== undefined)) {
      this.validateSpellProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'magical-item' || tmpl === 'magicalitem' || (targetSchema && targetSchema.entityType !== undefined)) {
      this.validateMagicalItemProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'species' || tmpl === 'race' || (targetSchema && targetSchema.baseSpeed !== undefined && targetSchema.baseLanguages !== undefined)) {
      this.validateSpeciesProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'class' || (targetSchema && targetSchema.levelProgression !== undefined)) {
      this.validateClassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'subclass' || (targetSchema && targetSchema.className !== undefined && targetSchema.classId !== undefined)) {
      this.validateSubclassProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'feat' || (targetSchema && targetSchema.featType !== undefined)) {
      this.validateFeatProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'background' || (targetSchema && targetSchema.feat !== undefined && targetSchema.skillProficiency !== undefined)) {
      this.validateBackgroundProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
    } else if (tmpl === 'weapon' || (targetSchema && targetSchema.masteries !== undefined && targetSchema.damageType !== undefined)) {
      this.validateWeaponProperties(data, targetSchema, options, coercedFields, warnings, errors, () => checksRun++);
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

    // 6. Speed
    tickCheck();
    if (typeof data.speed !== 'string') {
      data.speed = String(data.speed || '30 ft.');
      coercedFields.push({
        path: 'speed',
        original: data.speed,
        coerced: '30 ft.',
        reason: 'Coerced speed to string'
      });
    } else {
      // Clean up parenthetical like "40 ft. (8 spaces)" -> keep "40 ft." or full
      const speedMatch = data.speed.match(/^(\d+\s*ft\.)/i);
      if (speedMatch && data.speed.includes('spaces')) {
        const cleanSpeed = speedMatch[1];
        coercedFields.push({
          path: 'speed',
          original: data.speed,
          coerced: cleanSpeed,
          reason: 'Cleaned speed to standard ft format'
        });
        data.speed = cleanSpeed;
      }
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

    // 10. Arrays (skills, savingThrows, traits, actions, reactions, legendaryActions, books)
    tickCheck();
    data.skills = Array.isArray(data.skills) ? data.skills : (typeof data.skills === 'string' ? data.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    data.savingThrows = Array.isArray(data.savingThrows) ? data.savingThrows : [];
    data.traits = Array.isArray(data.traits) ? data.traits : [];
    data.reactions = Array.isArray(data.reactions) ? data.reactions : [];
    data.legendaryActions = Array.isArray(data.legendaryActions) ? data.legendaryActions : [];

    // Ensure actions is array of { name, description }
    tickCheck();
    if (Array.isArray(data.actions)) {
      data.actions = data.actions.map((act: any, i: number) => {
        if (typeof act === 'string') {
          const dotIndex = act.indexOf('.');
          if (dotIndex > 0) {
            const name = act.substring(0, dotIndex).trim();
            const description = act.substring(dotIndex + 1).trim();
            coercedFields.push({
              path: `actions[${i}]`,
              original: act,
              coerced: { name, description },
              reason: 'Converted string action to structured { name, description }'
            });
            return { name, description };
          }
          return { name: `Action ${i + 1}`, description: act };
        }
        return {
          name: act.name ? String(act.name).trim() : `Action ${i + 1}`,
          description: act.description ? String(act.description).trim() : ''
        };
      });
    } else {
      data.actions = [];
    }

    // 11. Books array
    this.ensureBooksArray(data, options, coercedFields, tickCheck);

    // 12. String immunities and resistances
    data.damageResistances = data.damageResistances || '';
    data.damageImmunities = data.damageImmunities || '';
    data.conditionImmunities = data.conditionImmunities || '';
    data.languages = data.languages || '—';

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
    if (data.level !== undefined) {
      const lvlStr = String(data.level).trim();
      data.level = lvlStr;
    } else {
      data.level = '0';
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
    data.components = data.components || 'V, S';
    data.ritual = Boolean(data.ritual);
    data.concentration = Boolean(data.concentration);
    data.classes = Array.isArray(data.classes) ? data.classes : [];
    data.system = data.system || 'dnd5e';

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'atHigherLevels'], tickCheck);
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
    data.features = Array.isArray(data.features) ? data.features : [];
    data.system = data.system || 'dnd5e';

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
    if (data.baseSpeed !== undefined) {
      const spdInt = parseInt(String(data.baseSpeed), 10);
      if (!isNaN(spdInt)) {
        data.baseSpeed = spdInt;
      }
    } else {
      data.baseSpeed = 30;
    }
    data.speed = data.speed || `${data.baseSpeed} ft.`;

    tickCheck();
    data.baseLanguages = Array.isArray(data.baseLanguages) ? data.baseLanguages : ['Common'];
    data.features = Array.isArray(data.features) ? data.features : [];
    data.system = data.system || 'dnd5e';

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
  }

  /**
   * Class property validation
   */
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
    if (data.traits.hitDie && !/^1d(6|8|10|12)$/i.test(data.traits.hitDie)) {
      warnings.push(`Hit die "${data.traits.hitDie}" is non-standard for 5e`);
    }

    data.traits.primaryAbility = Array.isArray(data.traits.primaryAbility) ? data.traits.primaryAbility : ['Strength'];
    data.traits.savingThrowProficiencies = Array.isArray(data.traits.savingThrowProficiencies) ? data.traits.savingThrowProficiencies : [];
    data.traits.armorProficiencies = Array.isArray(data.traits.armorProficiencies) ? data.traits.armorProficiencies : [];
    data.traits.weaponProficiencies = Array.isArray(data.traits.weaponProficiencies) ? data.traits.weaponProficiencies : [];

    tickCheck();
    if (!data.spellcasting || typeof data.spellcasting !== 'object') {
      data.spellcasting = { spellcastingType: 'none', spellcastingAbility: null };
    }

    tickCheck();
    data.levelProgression = Array.isArray(data.levelProgression) ? data.levelProgression : [];
    data.system = data.system || 'dnd5e';

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
    data.features = Array.isArray(data.features) ? data.features : [];
    data.system = data.system || 'dnd5e';

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
    data.prerequisite = data.prerequisite || 'None';
    data.repeatable = Boolean(data.repeatable);
    data.features = Array.isArray(data.features) ? data.features : [];
    data.system = data.system || 'dnd5e';

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description', 'features'], tickCheck);
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
    data.system = data.system || 'dnd5e';

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
    data.masteries = Array.isArray(data.masteries) ? data.masteries : [];
    data.type = data.isMagical ? 'magic-weapon' : 'weapon';
    data.isMagical = Boolean(data.isMagical);
    data.edition = data.edition || '2024';
    data.system = data.system || 'dnd5e';

    this.ensureBooksArray(data, options, coercedFields, tickCheck);
    this.ensureEmbeddedTranslation(data, options, ['name', 'description'], tickCheck);
  }

  private static ensureBooksArray(
    data: any,
    options: NormalizeOptions,
    coercedFields: CoercedField[],
    tickCheck: () => void
  ) {
    tickCheck();
    const defaultBook = options.defaults?.books?.[0] || (options.template === 'monster' ? 'Monster Manual 2024' : "Player's Handbook 2024");
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
