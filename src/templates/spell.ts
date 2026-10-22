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
  description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.\n\nThe fire spreads around corners. It ignites flammable objects in the area that aren’t being worn or carried.',
  atHigherLevels: 'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  classes: ['Sorcerer', 'Wizard'],
  ritual: false,
  concentration: false,
  books: ["Player's Handbook 2024"],
  system: 'dnd5e',
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
12. classes: Array of class names that have this spell on their list (e.g. ["Sorcerer", "Wizard"]).`;

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
