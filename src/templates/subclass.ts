export const SUBCLASS_TEMPLATE = {
  _id: '68e065e63483269c7c881880',
  name: 'Champion',
  description: 'The prototypical Champion focuses on the development of raw physical power honed to deadly perfection. Those who model themselves on this archetype combine rigorous training with physical excellence to deal devastating blows.',
  flavorText: 'A martial archetype that excels in raw physical power and devastating critical hits.',
  classId: 'Fighter',
  className: 'Fighter',
  features: [
    {
      name: 'Improved Critical',
      description: 'Your weapon attacks score a critical hit on a roll of 19 or 20 on the d20.',
      level: 3
    },
    {
      name: 'Remarkable Athlete',
      description: 'You can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that does not already use your proficiency bonus. In addition, when you make a running long jump, the distance you can cover increases by a number of feet equal to your Strength modifier.',
      level: 7
    },
    {
      name: 'Additional Fighting Style',
      description: 'You can choose a second Fighting Style feat.',
      level: 10
    },
    {
      name: 'Superior Critical',
      description: 'Your weapon attacks score a critical hit on a roll of 18–20 on the d20.',
      level: 15
    },
    {
      name: 'Survivor',
      description: 'You attain the pinnacle of resilience in battle. At the start of each of your turns in combat, you regain Hit Points equal to 5 + your Constitution modifier if you have no more than half of your Hit Points left.',
      level: 18
    }
  ],
  books: ["Player's Handbook 2024"],
  system: 'dnd5e',
  translations: {
    'pt-BR': {
      name: 'Campeão',
      description: 'O protótipo do Campeão concentra-se no desenvolvimento do poder físico bruto aperfeiçoado até a perfeição mortal...',
      flavorText: 'Um arquétipo marcial que se destaca pelo poder físico e acertos críticos devastadores.',
      features: [
        {
          name: 'Crítico Aprimorado',
          description: 'Seus ataques com armas obtêm um acerto crítico com uma rolagem de 19 ou 20 no d20.'
        },
        {
          name: 'Atleta Notável',
          description: 'Você pode adicionar metade do seu bônus de proficiência a testes de Força, Destreza ou Constituição que ainda não usem proficiência.'
        },
        {
          name: 'Estilo de Luta Adicional',
          description: 'Você pode escolher um segundo talento de Estilo de Luta.'
        },
        {
          name: 'Crítico Superior',
          description: 'Seus ataques com armas obtêm um acerto crítico com uma rolagem de 18 a 20 no d20.'
        },
        {
          name: 'Sobrevivente',
          description: 'No início de cada um dos seus turnos em combate, você recupera Pontos de Vida iguais a 5 + seu modificador de Constituição se tiver metade ou menos dos seus PV.'
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

export const SUBCLASS_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D SUBCLASSES:
1. name: Subclass archetype name (e.g., "Champion", "Evoker", "Circle of the Moon").
2. className: Name of the parent class (e.g., "Fighter", "Wizard", "Druid", "Paladin").
3. classId: Return the human-readable NAME of the parent class (e.g. "Fighter") - do NOT generate an ObjectId. The importing script will resolve the database relationship by matching the class name.
4. features: Array of subclass features. Each feature must have:
   - name: Feature name
   - description: Complete feature rules text
   - level: Numeric class level when feature is unlocked (e.g. 3, 7, 10, 15, 18 for Fighter; 3, 6, 14 for Sorcerer; 2, 6, 10, 14 for Wizard).
5. If the subclass grants spells (e.g. Domain spells, Oath spells, Circle spells), extract them into spellList array using spell NAMES (e.g. [{ level: 3, spells: ["Bless", "Cure Wounds"] }]).
6. books: Array of source book names (e.g. ["Player's Handbook 2024"]) or book ObjectIds.`;

export const SUBCLASS_EXAMPLE_PARAGRAPH = `Champion
Fighter Subclass
Source: Player's Handbook 2024

The archetypal Champion focuses on the development of raw physical power honed to deadly perfection. Those who model themselves on this archetype combine rigorous training with physical excellence to deal devastating blows.

Improved Critical
At 3rd level, your weapon attacks score a critical hit on a roll of 19 or 20 on the d20.

Remarkable Athlete
Starting at 7th level, you can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency bonus.

Additional Fighting Style
At 10th level, you can choose a second option from the Fighting Style class feature.

Superior Critical
Starting at 15th level, your weapon attacks score a critical hit on a roll of 18–20 on the d20.

Survivor
At 18th level, you attain the pinnacle of resilience in battle. At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half of your hit points left. You don't gain this benefit if you have 0 hit points.`;
