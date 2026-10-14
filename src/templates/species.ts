export const SPECIES_TEMPLATE = {
  _id: '68e065e63483269c7c881860',
  name: 'Elf',
  description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. They live in places of ethereal beauty, in the midst of ancient forests or in silvery spires glittering with faerie light.',
  creatureType: 'Humanoid',
  size: 'Medium',
  baseSpeed: 30,
  speed: '30 ft.',
  baseLanguages: ['Common', 'Elvish'],
  features: [
    {
      id: 'darkvision',
      name: 'Darkvision',
      description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      category: 'Senses'
    },
    {
      id: 'keen-senses',
      name: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      category: 'Skills'
    },
    {
      id: 'fey-ancestry',
      name: 'Fey Ancestry',
      description: 'You have Advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
      category: 'Defense'
    },
    {
      id: 'trance',
      name: 'Trance',
      description: "You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation.",
      category: 'Racial Trait'
    }
  ],
  books: ["Player's Handbook 2024"],
  system: 'dnd5e',
  translations: {
    'pt-BR': {
      name: 'Elfo',
      description: 'Elfos são um povo mágico de graça sobrenatural, vivendo no mundo mas não inteiramente parte dele...',
      features: [
        {
          name: 'Visão no Escuro',
          description: 'Você pode enxergar na penumbra a até 18 metros como se fosse luz plena, e na escuridão como se fosse penumbra.',
          category: 'Senses'
        },
        {
          name: 'Sentidos Aguçados',
          description: 'Você tem proficiência na perícia Percepção.',
          category: 'Skills'
        },
        {
          name: 'Ancestralidade Feérica',
          description: 'Você tem Vantagem em salvaguardas para evitar ou encerrar a condição Enfeitiçado em você.',
          category: 'Defense'
        },
        {
          name: 'Transe',
          description: 'Você não precisa dormir e magia não pode colocá-lo para dormir. Você pode completar um Descanso Longo em 4 horas meditando.',
          category: 'Racial Trait'
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

export const SPECIES_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR SPECIES / RACES:
1. creatureType: Usually 'Humanoid', 'Fey', 'Undead', 'Celestial', or 'Fiend'.
2. size: Strictly one of ['Tiny', 'Small', 'Medium', 'Large'].
3. baseSpeed: Numeric integer (e.g., 30 for 30 ft., 35 for 35 ft.).
4. speed: Formatted string representation (e.g. "30 ft.").
5. baseLanguages: Array of languages granted (e.g., ["Common", "Elvish"]).
6. features: Extract every species trait into the features array with { id (kebab-case), name, description, category }.
   Category must be one of: ['Passive', 'Active', 'Combat', 'Utility', 'Racial Trait', 'Defense', 'Senses', 'Skills', 'Spellcasting'].
   - Senses: Darkvision, Blindsight, Superior Darkvision
   - Defense: Fey Ancestry, Poison Resilience, Dwarven Toughness
   - Skills: Keen Senses, Skill Versatility
   - Racial Trait: Trance, Breath Weapon, Powerful Build, Relentless Endurance
   - Spellcasting: Drow Magic, High Elf Cantrip`;

export const SPECIES_EXAMPLE_PARAGRAPH = `Elf
Creature Type: Humanoid
Size: Medium (about 5–6 feet tall)
Speed: 30 feet
Languages: Common, Elvish

Traits:
Darkvision. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.
Fey Ancestry. You have Advantage on saving throws you make to avoid or end the Charmed condition on yourself.
Keen Senses. You have proficiency in the Perception skill.
Trance. You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.`;
