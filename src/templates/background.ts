export const BACKGROUND_TEMPLATE = {
  _id: '68e065e63483269c7c8818a0',
  name: 'Soldier',
  description: 'You began training for war as soon as you were old enough to lift a weapon. You learned how to survive on a battlefield, follow orders, and work as part of a unit.',
  feat: 'Savage Attacker',
  abilityScoreIncrease: ['Strength', 'Dexterity', 'Constitution'],
  skillProficiency: ['Athletics', 'Intimidation'],
  toolProficiency: ['One kind of Gaming Set'],
  languages: [],
  equipment: [
    {
      id: 'eq-soldier-1',
      name: 'Soldier Equipment',
      description: 'Starting gear for a soldier',
      items: [
        { name: 'Spear', quantity: 1 },
        { name: 'Shortbow', quantity: 1 },
        { name: '20 Arrows', quantity: 1 },
        { name: "Healer's Kit", quantity: 1 },
        { name: 'Gaming Set', quantity: 1 },
        { name: 'Traveler’s Clothes', quantity: 1 }
      ]
    }
  ],
  features: [
    {
      name: 'Military Rank',
      description: 'You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority and influence.',
      category: 'Social'
    }
  ],
  books: ["Player's Handbook 2024"],
  system: 'dnd5e',
  translations: {
    'pt-BR': {
      name: 'Soldado',
      description: 'Você começou a treinar para a guerra assim que teve idade suficiente para erguer uma arma...',
      equipment: [
        {
          name: 'Equipamento de Soldado',
          description: 'Equipamento inicial de um soldado'
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

export const BACKGROUND_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D BACKGROUNDS:
1. name: Background name (e.g., "Soldier", "Acolyte", "Criminal", "Sage").
2. abilityScoreIncrease: Array of three ability scores that can be increased (e.g., ["Strength", "Dexterity", "Constitution"]).
3. feat: Return the human-readable NAME of the origin feat granted (e.g. "Savage Attacker", "Alert", "Magic Initiate", "Tough") - do NOT generate an ObjectId. The importing script will resolve the database relationship by feat name.
4. skillProficiency: Array of 2 skills granted (e.g. ["Athletics", "Intimidation"]).
5. toolProficiency: Array of tools or gaming sets granted.
6. equipment: Equipment options and item names (e.g. Spear, Shortbow) with quantity.
7. features: Background features with { name, description, category: 'Social' | 'Utility' | 'Skills' | 'Active' | 'Passive' }.
8. books: Array of source book names (e.g. ["Player's Handbook 2024"]) or book ObjectIds if specified.`;

export const BACKGROUND_EXAMPLE_PARAGRAPH = `Soldier
Source: Player's Handbook 2024
Ability Scores: Strength, Dexterity, Constitution
Feat: Savage Attacker
Skill Proficiencies: Athletics, Intimidation
Tool Proficiency: One kind of Gaming Set
Equipment: Spear, Shortbow, 20 Arrows, Healer's Kit, Gaming Set, Traveler's Clothes, 14 GP

You began training for war as soon as you were old enough to lift a weapon. You learned how to survive on a battlefield, follow orders, and work as part of a unit.`;
