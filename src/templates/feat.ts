export const FEAT_TEMPLATE = {
  _id: '68e065e63483269c7c881890',
  name: 'Great Weapon Master',
  description: 'You have learned to put the weight of a weapon to your advantage, letting its momentum empower your strikes.',
  featType: 'General',
  prerequisite: 'Level 4+, Strength 13+',
  abilityScoreIncrease: {
    abilities: ['Strength'],
    amount: 1,
    choice: false
  },
  repeatable: false,
  features: [
    {
      name: 'Ability Score Increase',
      description: 'Increase your Strength score by 1, to a maximum of 20.',
      category: 'Utility'
    },
    {
      name: 'Hew',
      description: 'Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the weapon as a Bonus Action.',
      category: 'Combat'
    },
    {
      name: 'Heavy Weapon Mastery',
      description: 'When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage to the target equal to your Proficiency Bonus.',
      category: 'Combat'
    }
  ],
  books: ["Player's Handbook 2024"],
  edition: '2024',
  system: 'D&D 5.5e',
  translations: {
    'pt-BR': {
      name: 'Mestre em Armas Grandes',
      description: 'Você aprendeu a usar o peso de uma arma a seu favor, permitindo que seu impulso fortaleça seus ataques.',
      featType: 'Geral',
      prerequisite: 'Nível 4+, Força 13+',
      features: [
        {
          name: 'Aumento no Valor de Habilidade',
          description: 'Aumente seu valor de Força em 1, até o máximo de 20.'
        },
        {
          name: 'Golpear',
          description: 'Imediatamente após obter um Acerto Crítico com uma arma Corpo a Corpo ou reduzir uma criatura a 0 PV com ela, você pode realizar um ataque com a arma como Ação Bônus.'
        },
        {
          name: 'Maestria com Armas Pesadas',
          description: 'Quando você acertar uma criatura com uma arma com a propriedade Pesada como parte da ação Atacar no seu turno, você pode causar dano extra igual ao seu Bônus de Proficiência.'
        }
      ],
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

export const FEAT_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D FEATS:
1. featType: Must be one of ['Origin', 'General', 'Fighting Style', 'Epic Boon'].
2. prerequisite: Prerequisites string (e.g., "Level 4+, Strength 13+" or "None").
3. repeatable: Boolean, true only if explicitly stated that the feat can be taken multiple times.
4. abilityScoreIncrease:
   - ONLY include 'abilityScoreIncrease' when the feat actually grants an Ability Score Increase. When a feat does NOT grant an Ability Score Increase (e.g., Origin feats or Fighting Style feats), OMIT 'abilityScoreIncrease' entirely (NEVER output { abilities: [], amount: 0 }).
   - 'abilities' MUST ONLY contain canonical ability names from: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]. NEVER output "Choice" or "One ability score of your choice".
   - When a feat says "Increase one ability score of your choice by 1" or "Choose one ability... Increase the chosen ability score by 1" (e.g., Resilient, Skill Expert, Epic Boons, Familiar feats), output ALL 6 canonical ability names in 'abilities' with amount: 1, choice: true.
   - 'choice' MUST be true whenever 'abilities.length > 1'.
   - Set 'grantsSavingThrowProficiency: true' if and only if the feat grants saving throw proficiency in the chosen ability (e.g., Resilient).
5. features: Break down each distinct benefit / bullet point into the features array with { name, description, category }.
   - Category must be one of: ['Combat', 'Utility', 'Spellcasting', 'Skills', 'Active', 'Passive'].
   - NEVER merge a subsequent feat (a heading followed by "General Feat", "Origin Feat", "Fighting Style Feat", or "Epic Boon Feat") or decorative all-caps pull-quotes into 'features'.
   - NEVER turn rows of a "<Feat Name> Spells" table into separate entries in 'features'. Keep the benefit paragraph immediately preceding a spell table (e.g., Prescient Intervention) intact as its own feature.
6. SPELL TABLES & grantedSpellsAlwaysPrepared (on 'features[]'):
   - When a feat has a "<Feat Name> Spells" table (e.g., School Adept feats mapping Spell Slot Level 1..5 -> Spell):
     a) Embed the table as a single-line HTML block (no '\\n' inside the div) at the end of the "Additional Spells" feature 'description' (and in 'translations["pt-BR"].features[].description'), wrapping every spell name in [spell]Spell Name[/spell] tags:
        <div class="feat-spell-table-wrap"><p><strong>Evocation Adept Spells</strong></p><table><thead><tr><th>Spell Slot Level</th><th>Spell</th></tr></thead><tbody><tr><td>1</td><td>[spell]Chromatic Orb[/spell]</td></tr><tr><td>2</td><td>[spell]Shatter[/spell]</td></tr><tr><td>3</td><td>[spell]Fireball[/spell]</td></tr><tr><td>4</td><td>[spell]Vitriolic Sphere[/spell]</td></tr><tr><td>5</td><td>[spell]Wall of Force[/spell]</td></tr></tbody></table></div>
     b) Populate 'grantedSpellsAlwaysPrepared' on that feature with [{ "spellName": "Chromatic Orb", "minSlotLevel": 1 }, ...] (or "minCharacterLevel" when gated by character level).
   - When a feature states "You always have the X spell prepared" or "You learn the X cantrip" (e.g., Misty Step on Fey Touched, Invisibility on Shadow Touched), populate 'grantedSpellsAlwaysPrepared': [{ "spellName": "Misty Step" }].
7. choices[] ON SPELL-CHOOSING & ABILITY-CHOOSING FEATS:
   - Every choice must have a unique 'id', valid 'type' ("skill" | "tool" | "spell" | "spell-list" | "language" | "ability" | "fighting-style" | "weapon"), 'count' >= 1, and 'description'.
   - NEVER set 'options' on a 'type: "spell"' choice that picks actual spells! Omit 'options' and put filters in 'restrictions':
     - 'spellLevel': 0 (cantrip) or 1..9
     - 'spellList': array from ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"] (omit if the spell comes from a sibling 'spell-list' choice or is restricted only by school/ritual)
     - 'school': array from ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"] (e.g., ["Divination", "Enchantment"] for Fey Touched)
     - 'ritual': true (e.g., for Ritual Caster)
   - Only use 'options: ["Cleric", "Druid", "Wizard"]' when the player must first choose WHICH class's spell list to use ('id: "spell-list"', 'type: "spell-list"', no 'restrictions'), and then sibling 'type: "spell"' choices only need 'restrictions: { "spellLevel": N }'.
   - If the player chooses a spellcasting ability (e.g., "Intelligence, Wisdom, or Charisma is your spellcasting ability for this spell"), include a choice with 'id: "spellcasting-ability"', 'type: "ability"', 'count: 1', 'options: ["Intelligence", "Wisdom", "Charisma"]'.
8. description: General introductory overview of the feat. CRITICAL: If the source text jumps directly into named benefits or bullet points without an introductory paragraph, populate description with "You gain the following benefits." NEVER leave description empty.
9. edition: "2024", system: "D&D 5.5e".

FEATURE LIMITED USES & RECHARGE:
For each feature in 'features':
If the feature can only be used a limited number of times before recharging:
- 'maxUses':
  - Static number: 1, 2, 3...
  - Proficiency bonus: { "type": "proficiencyBonus" }
  - Ability modifier: { "type": "abilityModifier", "ability": "charisma" | "strength" | ..., "minimum": 1 }
  - Level-based: { "type": "classLevel", "multiplier": 1 } or { "type": "characterLevel" }
- 'usesRecharge':
  - Short rest: { "shortRest": "all" } or { "shortRest": 1, "longRest": "all" }
  - Long rest only: { "longRest": "all" }
  - Dawn: { "dawn": "all" } or { "dawn": 1 }
If the feature is passive (e.g. Darkvision, unarmored defense), omit 'maxUses' and 'usesRecharge'.`;

export const FEAT_EXAMPLE_PARAGRAPH = `Great Weapon Master
General Feat (Prerequisite: Level 4+, Strength 13+)

You have learned to put the weight of a weapon to your advantage, letting its momentum empower your strikes. You gain the following benefits.

Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.
Hew. Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the weapon as a Bonus Action.
Heavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage to the target equal to your Proficiency Bonus.`;
