export const ARMOR_TEMPLATE = {
  _id: '68e065e63483269c7c8818c0',
  name: 'Plate Armor',
  armorType: 'Heavy',
  armorClass: '18',
  strengthRequirement: 15,
  stealthDisadvantage: true,
  weight: 65,
  cost: 1500,
  description: 'Plate consists of shaped, interlocking metal plates to cover the entire body. A suit of plate includes gauntlets, heavy leather boots, a visored helmet, and thick layers of padding underneath the armor. Buckles and straps distribute the weight over the body.',
  type: 'armor',
  isMagical: false,
  edition: '2024',
  system: 'D&D 5.5e',
  books: ["Player's Handbook 2024"],
  translations: {
    'pt-BR': {
      name: 'Armadura de Placas',
      description: 'A armadura de placas consiste em placas de metal moldadas e entrelaçadas que cobrem todo o corpo. Um conjunto inclui manoplas, botas pesadas de couro, elmo com viseira e grossas camadas de acolchoamento.',
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

export const ARMOR_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D ARMOR & SHIELDS:
1. name: Armor name (e.g., "Plate Armor", "Leather Armor", "Chain Mail", "Shield").
2. armorType: Strictly one of: "Light", "Medium", "Heavy", "Shield".
3. armorClass: Base armor class string or number (e.g. "18" for Plate, "16" for Chain Mail, "14 + Dex modifier (max 2)" for Scale Mail, "11 + Dex modifier" for Leather Armor, "2" for Shield).
4. strengthRequirement: Minimum Strength score required to avoid speed penalty (e.g., 15 for Plate, 13 for Chain Mail), or null / omitted if none.
5. stealthDisadvantage: Boolean (true if wearing this armor imposes disadvantage on Stealth checks, otherwise false).
6. weight: Numeric weight in pounds (e.g. 65 for Plate, 55 for Chain Mail, 6 for Shield).
7. cost: Numeric cost in GP (e.g. 1500 for 1500 GP, 75 for 75 GP, 10 for 10 GP).
8. description: Detailed description of the armor.
9. type: "armor" (or "magic-armor" if magical). isMagical: false (or true).
10. edition: "2024", system: "D&D 5.5e".`;

export const ARMOR_EXAMPLE_PARAGRAPH = `Plate Armor
Heavy Armor
Cost: 1,500 GP
Armor Class: 18
Strength: 15
Stealth: Disadvantage
Weight: 65 lbs.

Plate consists of shaped, interlocking metal plates to cover the entire body. A suit of plate includes gauntlets, heavy leather boots, a visored helmet, and thick layers of padding underneath the armor. Buckles and straps distribute the weight over the body.`;
