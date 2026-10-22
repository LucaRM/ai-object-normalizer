export const CLASS_TEMPLATE = {
  _id: '68e065e63483269c7c881870',
  name: 'Fighter',
  description: 'Fighters master the martial arts, combat maneuvers, and all manner of weapons and armor. Exceptional warriors, they excel in battle with sheer stamina and devastating precision.',
  flavorText: 'A master of martial combat, skilled with a variety of weapons and armor.',
  hitDie: '1d10',
  primaryAbility: 'Strength',
  savingThrowProficiency: ['Strength', 'Constitution'],
  armorProficiency: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shield'],
  weaponProficiency: ['Simple Weapons', 'Martial Weapons'],
  toolProficiency: [],
  skillProficiency: [
    'Acrobatics',
    'Animal Handling',
    'Athletics',
    'History',
    'Insight',
    'Intimidation',
    'Perception',
    'Survival'
  ],
  startingEquipment: 'Chain Mail or Leather Armor with Longbow, Martial Weapon and Shield or two Martial Weapons.',
  features: [
    {
      name: 'Fighting Style',
      description: 'You hone your martial prowess with a Fighting Style feat of your choice.',
      category: 'Combat',
      classLevel: 1
    },
    {
      name: 'Second Wind',
      description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a Bonus Action to regain Hit Points equal to 1d10 plus your Fighter level.',
      category: 'Combat',
      classLevel: 1
    },
    {
      name: 'Weapon Mastery',
      description: 'Your training with weapons allows you to use the Mastery properties of three kinds of weapons of your choice.',
      category: 'Combat',
      classLevel: 1
    }
  ],
  traits: {
    hitDie: '1d10',
    primaryAbility: ['Strength', 'Dexterity'],
    savingThrowProficiencies: ['Strength', 'Constitution'],
    skillProficiencies: {
      choose: 2,
      from: [
        'Acrobatics',
        'Animal Handling',
        'Athletics',
        'History',
        'Insight',
        'Intimidation',
        'Perception',
        'Survival'
      ]
    },
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shield'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
    toolProficiencies: [],
    startingEquipment: {
      description: 'Chain Mail or Leather Armor with Longbow, Martial Weapon and Shield or two Martial Weapons.',
      options: ['Chain Mail and Martial Weapon', 'Leather Armor, Longbow, and 20 Arrows']
    },
    subclassChoiceLevel: 3
  },
  spellcasting: {
    spellcastingType: 'none',
    spellcastingAbility: null
  },
  levelProgression: [
    {
      level: 1,
      proficiencyBonus: 2,
      features: [
        {
          name: 'Fighting Style',
          description: 'You hone your martial prowess with a Fighting Style feat of your choice.',
          category: 'Combat',
          classLevel: 1
        },
        {
          name: 'Second Wind',
          description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a Bonus Action to regain Hit Points equal to 1d10 plus your Fighter level.',
          category: 'Combat',
          classLevel: 1
        },
        {
          name: 'Weapon Mastery',
          description: 'Your training with weapons allows you to use the Mastery properties of three kinds of weapons of your choice.',
          category: 'Combat',
          classLevel: 1
        }
      ]
    },
    {
      level: 2,
      proficiencyBonus: 2,
      features: [
        {
          name: 'Action Surge',
          description: 'You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action.',
          category: 'Combat',
          classLevel: 2
        },
        {
          name: 'Tactical Mind',
          description: 'You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use of your Second Wind to add 1d10 to the check.',
          category: 'Utility',
          classLevel: 2
        }
      ]
    },
    {
      level: 3,
      proficiencyBonus: 2,
      features: [
        {
          name: 'Fighter Subclass',
          description: 'You choose a martial archetype that shapes the way you fight, such as the Champion or Eldritch Knight.',
          category: 'Class Feature',
          classLevel: 3
        }
      ]
    }
  ],
  books: ["Player's Handbook 2024"],
  system: 'dnd5e',
  translations: {
    'pt-BR': {
      name: 'Guerreiro',
      description: 'Guerreiros dominam as artes marciais, manobras de combate e todo tipo de arma e armadura...',
      flavorText: 'Um mestre do combate marcial, habilidoso com uma variedade de armas e armaduras.',
      traits: {
        startingEquipment: {
          description: 'Cota de Malha ou Armadura de Couro com Arco Longo, Arma Marcial e Escudo.'
        }
      },
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

export const CLASS_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D CLASSES:
1. name: Extract the class name strictly from the first line or header (e.g. "Barbarian", "Fighter", "Rogue"). NEVER default to "Fighter" unless the text is about Fighters!
2. Root-Level Structured Fields (Crucial for Character Sheet & API Automation):
   - hitDie: String representing hit die (e.g. "d12" or "1d12" for Barbarian, "1d10" for Fighter, "1d8" for Rogue, "1d6" for Wizard).
   - primaryAbility: String representing primary ability (e.g. "Strength" for Barbarian, "Dexterity" for Rogue, "Intelligence" for Wizard).
   - savingThrowProficiency: Array of 2 ability strings (e.g. ["Strength", "Constitution"] for Barbarian/Fighter, ["Dexterity", "Intelligence"] for Rogue).
   - armorProficiency: Array of armor training (e.g. ["Light Armor", "Medium Armor", "Shields"] for Barbarian).
   - weaponProficiency: Array of weapon proficiencies (e.g. ["Simple Weapons", "Martial Weapons"]).
   - toolProficiency: Array of tool proficiencies (e.g. [] or ["Thieves' Tools"]).
   - skillProficiency: Array of available skill options.
   - startingEquipment: Summary string or equipment description.
   - features: Flat array of all class features extracted from the text [{ name, description, classLevel, category }].
3. traits: Also populate the traits object containing hitDie, primaryAbility, savingThrowProficiencies, armorProficiencies, weaponProficiencies for backward compatibility.
4. spellcasting: Set spellcastingType to 'none', 'full', 'half', 'third', or 'pact'. Set spellcastingAbility to 'Intelligence', 'Wisdom', 'Charisma', or null.
5. levelProgression: Array of level objects [{ level: number, proficiencyBonus: number, features: ClassFeature[] }].
   Category must be one of: ['Class Feature', 'Combat', 'Utility', 'Spellcasting', 'Active', 'Passive'].`;

export const CLASS_EXAMPLE_PARAGRAPH = `Fighter
Primary Ability: Strength or Dexterity
Hit Point Die: 1d10 per Fighter level
Saving Throw Proficiencies: Strength, Constitution
Skill Proficiencies: Choose 2 from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival
Weapon Proficiencies: Simple and Martial weapons
Armor Training: Light, Medium, and Heavy armor, and Shields

Level 1:
Fighting Style. You hone your martial prowess with a Fighting Style feat of your choice.
Second Wind. You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a Bonus Action to regain Hit Points equal to 1d10 plus your Fighter level.
Weapon Mastery. Your training with weapons allows you to use the Mastery properties of three kinds of weapons of your choice.

Level 2:
Action Surge. You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action.
Tactical Mind. When you fail an ability check, you can expend a use of your Second Wind to add 1d10 to the d20 roll.

Level 3:
Fighter Subclass. You gain a Fighter subclass of your choice.`;
