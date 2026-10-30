export const SPELL_TEMPLATE = {
  _id: '68e065e63483269c7c881810',
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  castingAction: 'Action',
  castingTime: '1 Action',
  duration: 'Instantaneous',
  range: '150 feet',
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialsDescription: 'a tiny ball of bat guano and sulfur'
  },
  damageType: 'fire',
  mechanics: {
    version: 1,
    save: {
      ability: 'DEX',
      onSuccess: 'half'
    },
    effects: [
      {
        id: 'main',
        kind: 'damage',
        dice: { count: 8, die: 6 },
        damageType: 'fire',
        when: 'onFailedSave'
      }
    ],
    area: {
      shape: 'sphere',
      size: 20
    },
    higherLevels: {
      aboveLevel: 3,
      every: 1,
      perStep: {
        effectDice: [
          {
            effectId: 'main',
            count: 1,
            die: 6
          }
        ]
      }
    }
  },
  description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.\n\nThe fire spreads around corners. It ignites flammable objects in the area that aren’t being worn or carried.',
  atHigherLevels: 'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  classes: ['Sorcerer', 'Wizard'],
  ritual: false,
  concentration: false,
  books: ["Player's Handbook 2024"],
  edition: '2024',
  system: 'D&D 5.5e',
  translations: {
    'pt-BR': {
      name: 'Bola de Fogo',
      description: 'Um raio brilhante lampeja do seu dedo indicador para um ponto que você escolher dentro do alcance e então floresce com um rugido baixo em uma explosão de chamas. Cada criatura em uma esfera de 6 metros de raio centrada naquele ponto deve fazer uma salvaguarda de Destreza. Um alvo sofre 8d6 de dano de fogo se falhar, ou metade se obtiver sucesso.',
      atHigherLevels: 'Quando você conjura esta magia usando um espaço de magia de 4º nível ou superior, o dano aumenta em 1d6 para cada nível de espaço acima do 3º.',
      _metadata: {
        locale: 'pt-BR',
        translatedAt: '2025-10-17T00:56:24.243Z',
        source: 'AI_TRANSLATION',
        quality: 'DRAFT'
      },
      metadata: {
        reviewed: false,
        translatedBy: 'ai'
      }
    }
  }
};

export const SPELL_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D SPELLS:
1. level: Numeric integer (0 for Cantrip, 1, 2, 3, etc. NEVER return "0" or "cantrip" as a string).
2. school: Standard spell school ('Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation').
3. castingAction: Primary action economy: 'Action', 'Bonus Action', 'Reaction', or 'Special'.
4. castingTime: Full casting time line (e.g., "1 Action", "1 Bonus Action", "1 Reaction, which you take when...").
5. range: Range string (e.g. "150 feet", "Touch", "Self (15-foot cone)").
6. components: Structured object { "verbal": boolean, "somatic": boolean, "material": boolean, "materialsDescription"?: string } (e.g., { "verbal": true, "somatic": true, "material": true, "materialsDescription": "a tiny ball of bat guano and sulfur" }).
7. duration: Duration string (e.g., "Instantaneous", "Concentration, up to 1 minute").
8. concentration: Boolean, true if duration requires concentration.
9. ritual: Boolean, true if the spell has the ritual tag.
10. damageType: Primary damage type (e.g. 'fire', 'radiant', 'necrotic', 'cold') or null if no damage.
11. atHigherLevels: Text describing higher-level upcasting benefits, if applicable.
12. classes: Array of class names that have this spell on their list (e.g. ["Sorcerer", "Wizard"]).
13. edition: "2024", system: "D&D 5.5e".

MECHANICS INSTRUCTIONS:
Extract the optional structured 'mechanics' field if the spell has attacks, saves, damage, healing, or level scaling:
- 'version': 1
- 'attack': if spell attack roll, specify { kind: 'melee' | 'ranged', rolls: number (e.g. 1, Scorching Ray: 3) }
- 'save': if targets make a saving throw, specify { ability: 'STR'|'DEX'|'CON'|'INT'|'WIS'|'CHA', onSuccess: 'half'|'none'|'other' }
- 'effects': array of { id: 'main', kind: 'damage'|'healing'|'tempHp'|'maxHp', dice: { count: X, die: Y }, flat?: Z, addSpellcastingModifier?: true, damageType: 'fire'|'acid'|..., when: 'onHit'|'onFailedSave'|'onCast' }
- 'targets': if specified count, { count: N, kind: 'creature'|'object'|'point'|'self', upTo?: boolean }
- 'area': if AoE, { shape: 'cone'|'cube'|'cylinder'|'emanation'|'line'|'sphere', size: number }
- 'higherLevels': for leveled spells when cast with a higher slot:
  { aboveLevel: <spell level>, every: 1, perStep: { effectDice?: [{ effectId: 'main', count: 1, die: 6 }], targets?: 1, attackRolls?: 1, flat?: [{ effectId: 'main', amount: 5 }] } }
- 'cantripScaling': for cantrips (level 0):
  { characterLevels: [5, 11, 17], perStep: { effectDice: [{ effectId: 'main', count: 1, die: <die> }], attackRolls?: 1 } }

If the spell does not involve attack rolls, saving throws, damage, or healing (e.g. Light, Alarm), set:
"mechanics": { "version": 1 }

ACTIVE EFFECT EXTRACTION:
If the spell alters a creature or caster over a duration (buffs, debuffs, stances, AC bonuses, saving throw/attack advantage/disadvantage, roll bonus dice like Bless/Bane, temp HP, movement speed, or applied conditions like Paralyzed/Invisible/Frightened):
Extract the structured 'activeEffect' field:
- 'version': 1
- 'appliesTo': 'self' (only caster affected) | 'creature' (can affect another creature or target)
- 'duration': { 'unit': 'round'|'minute'|'hour'|'day'|'untilDispelled'|'untilStartOfNextTurn'|'special', 'amount'?: number }
- 'concentration': boolean (must match the spell's concentration)
- 'endsWhen'?: optional array of events: ['donsArmor' | 'takesDamage' | 'attacksOrCasts' | 'savesSucceeds' | 'dropsTo0Hp']
- 'repeatSave'?: if repeated save ends it: { 'ability': 'WIS'|'CON'|..., 'when': 'endOfTurn'|'startOfTurn'|'whenDamaged' }
- 'modifiers': array of exact modifier types:
  - AC bonus: { "type": "ac", "mode": "bonus", "value": 2 } (Haste +2, Shield of Faith +2)
  - AC set base: { "type": "ac", "mode": "setBase", "value": 13, "addAbility": "DEX", "requiresNoArmor": true } (Mage Armor)
  - AC minimum: { "type": "ac", "mode": "minimum", "value": 17 } (2024 Barkskin)
  - Advantage / Disadvantage: { "type": "rollMode", "mode": "advantage"|"disadvantage", "roll": "attack"|"save"|"check"|"initiative", "abilities"?: ["DEX"], "against"?: true }
  - Roll Bonus / Penalty: { "type": "rollBonus", "roll": "attack"|"save", "abilities"?: "all"|["DEX"], "dice"?: { "count": 1, "die": 4 }, "sign"?: 1|-1, "value"?: -2 }
  - Speed: { "type": "speed", "mode": "multiply"|"bonus"|"set", "value": 2|10|0, "movement"?: "all"|"fly"|"climb" }
  - Max HP: { "type": "hpMax", "value": 5, "alsoCurrent": true } (Aid)
  - Temp HP: { "type": "tempHp", "value"?: 5, "dice"?: { "count": 2, "die": 4 }, "addSpellcastingModifier"?: true, "when"?: "onApply"|"startOfTurn" }
  - Defenses: { "type": "resistance"|"immunity", "damageTypes": ["psychic"] | { "fromChoice": "type" } }
  - Condition Immunity: { "type": "conditionImmunity", "conditions": ["frightened", "charmed"] }
  - Condition Applied: { "type": "applyCondition", "condition": "paralyzed"|"invisible"|"frightened" }
  - Damage Bonus: { "type": "damageBonus", "dice": { "count": 1, "die": 4 }, "damageType": "radiant", "on": "weaponHit" }
  - Extra Action: { "type": "extraAction", "actions": ["attackOneWeapon", "dash", "disengage", "hide", "utilize"] }
  - Restrictions: { "type": "restriction", "what": "noReactions"|"actionOrBonusAction"|"oneAttack"|"noActions"|"noMovement"|"noSpeech"|"cantConcentrate" }
  - Senses: { "type": "sense", "sense": "darkvision"|"seeInvisible", "range"?: 60 }
- 'perSlotAbove'?: for spells with scaling bonuses (Aid: +5 HP max per slot above 2):
  { "modifiers": [{ "type": "hpMax", "value": 5, "alsoCurrent": true }] }
- 'afterEnd'?: for spells with post-effect penalties (Haste lethargy):
  { "duration": { "unit": "round", "amount": 1 }, "modifiers": [{ "type": "restriction", "what": "noMovement" }, { "type": "restriction", "what": "noActions" }] }

CRITICAL RULE: If a rule cannot be expressed with these exact 16 modifier types, DO NOT approximate it. Leave that modifier out of the array and let the spell description handle it.
If the spell is instantaneous and only deals damage/healing (e.g. Fireball, Cure Wounds), omit 'activeEffect'.`;


export const SPELL_EXAMPLE_PARAGRAPH = `Fireball
3rd-level Evocation
Casting Time: 1 action
Range: 150 feet
Components: V, S, M (a tiny ball of bat guano and sulfur)
Duration: Instantaneous
Classes: Sorcerer, Wizard

A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.
The fire spreads around corners. It ignites flammable objects in the area that aren't being worn or carried.
At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.`;
