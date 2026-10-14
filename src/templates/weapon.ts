export const WEAPON_TEMPLATE = {
  _id: '68e065e63483269c7c8818b0',
  name: 'Longsword',
  category: 'Martial Melee Weapons',
  damage: '1d8',
  damageType: 'slashing',
  weight: 3,
  cost: 15,
  properties: ['Versatile (1d10)'],
  masteries: ['Sap'],
  description: 'Proficiency with a Longsword allows you to add your proficiency bonus to the attack roll for any attack you make with it. If used with two hands, it deals 1d10 slashing damage.',
  type: 'weapon',
  isMagical: false,
  edition: '2024',
  system: 'dnd5e',
  books: ["Player's Handbook 2024"],
  translations: {
    'pt-BR': {
      name: 'Espada Longa',
      description: 'A proficiência com uma Espada Longa permite adicionar seu bônus de proficiência à jogada de ataque. Se usada com as duas mãos, causa 1d10 de dano cortante.',
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

export const WEAPON_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D WEAPONS:
1. name: Weapon name (e.g., "Longsword", "Dagger", "Heavy Crossbow").
2. category: Strictly one of: "Simple Melee Weapons", "Simple Ranged Weapons", "Martial Melee Weapons", "Martial Ranged Weapons".
3. damage: Dice formula string (e.g. "1d8", "1d6", "2d6", "1d10", "1d4").
4. damageType: Strictly lowercase: 'slashing', 'piercing', or 'bludgeoning'.
5. weight: Numeric weight in pounds (e.g. 3, 2, 0.25).
6. cost: Numeric cost in GP (e.g. 15 for 15 gp, 2 for 2 gp, 0.05 for 5 cp).
7. properties: Array of weapon properties (e.g., ["Versatile (1d10)"], ["Finesse", "Light", "Thrown (20/60)"]).
8. masteries: Array of 2024 weapon mastery properties (e.g., ["Sap"], ["Nick"], ["Topple"], ["Vex"], ["Slow"], ["Push"], ["Graze"], ["Cleave"]).
9. type: "weapon" (or "magic-weapon" if magical). isMagical: false (or true).`;

export const WEAPON_EXAMPLE_PARAGRAPH = `Longsword
Martial Melee Weapon
Cost: 15 GP
Damage: 1d8 slashing
Weight: 3 lbs.
Properties: Versatile (1d10)
Mastery: Sap

Proficiency with a Longsword allows you to add your proficiency bonus to the attack roll for any attack you make with it.`;
