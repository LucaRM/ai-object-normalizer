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
  system: 'dnd5e',
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
4. abilityScoreIncrease: If the feat provides an ability score increase, populate { abilities: string[], amount: number, choice?: boolean }.
5. features: Break down each distinct benefit / bullet point into the features array with { name, description, category }.
   Category must be one of: ['Combat', 'Utility', 'Spellcasting', 'Skills', 'Active', 'Passive'].`;

export const FEAT_EXAMPLE_PARAGRAPH = `Great Weapon Master
General Feat (Prerequisite: Level 4+, Strength 13+)

You have learned to put the weight of a weapon to your advantage, letting its momentum empower your strikes. You gain the following benefits.

Ability Score Increase. Increase your Strength score by 1, to a maximum of 20.
Hew. Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the weapon as a Bonus Action.
Heavy Weapon Mastery. When you hit a creature with a weapon that has the Heavy property as part of the Attack action on your turn, you can cause the weapon to deal extra damage to the target equal to your Proficiency Bonus.`;
