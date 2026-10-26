export const SPECIES_TEMPLATE = {
  _id: '68e065e63483269c7c881860',
  name: 'Elf',
  description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. They live in places of ethereal beauty, in the midst of ancient forests or in silvery spires glittering with faerie light.',
  creatureType: 'Humanoid',
  size: 'Medium',
  baseSpeed: 30,
  speed: 30,
  baseLanguages: ['Common', 'Elvish'],
  features: [
    {
      id: 'darkvision',
      name: 'Darkvision',
      description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      category: 'Senses',
      senses: {
        darkvision: 60
      },
      mechanics: {
        senses: {
          darkvision: 60
        }
      }
    },
    {
      id: 'keen-senses',
      name: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      category: 'Skills',
      proficiencies: {
        skills: ['Perception']
      },
      mechanics: {
        proficiencies: {
          skills: ['Perception']
        }
      }
    },
    {
      id: 'elven-lineage',
      name: 'Elven Lineage',
      description: 'You are part of a lineage that grants you supernatural abilities. Choose a lineage: High Elf, Wood Elf, or Drow.',
      category: 'Racial Trait',
      selectable: true,
      requiresChoice: true,
      speciesWizardPick: 'lineagePick',
      options: [
        {
          id: 'high-elf',
          name: 'High Elf',
          description: 'You know one cantrip of your choice from the Wizard spell list.'
        },
        {
          id: 'wood-elf',
          name: 'Wood Elf',
          description: 'Your Speed increases to 35 feet.'
        },
        {
          id: 'drow',
          name: 'Drow',
          description: 'The range of your Darkvision increases to 120 feet.'
        }
      ],
      choices: {
        type: 'Custom',
        count: 1,
        options: ['High Elf', 'Wood Elf', 'Drow']
      }
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
  edition: '2024',
  system: 'D&D 5.5e',
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

export const SPECIES_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR SPECIES / RACES (Character Sheet Automation):
1. name: Extract the species name strictly from the first line or header of the Raw Text (e.g., "Dwarf Traits" -> "Dwarf", "Goliath" -> "Goliath", "Human" -> "Human"). NEVER default to, output, or mention "Elf" unless the raw text explicitly describes Elves!
2. description: Extract physical description and lore from the text. If the raw text only contains mechanical traits without lore, provide a concise summary of the traits. DO NOT invent lore of other species (NEVER mention Corellon, Lolth, or Elven forests when normalizing Dwarves, Orcs, or any non-elf species).
3. creatureType: Usually 'Humanoid', 'Fey', 'Undead', 'Celestial', or 'Fiend'.
4. size: Strictly one of ['Tiny', 'Small', 'Medium', 'Large'].
5. baseSpeed: Numeric integer (e.g., 30 for 30 ft., 35 for 35 ft.).
6. speed: Numeric walking speed integer (e.g., 30 for 30 ft., 35 for 35 ft. NEVER return "30 ft." as a string).
7. baseLanguages: Array of languages granted (e.g., ["Common", "Elvish"]).
8. features: Extract every species trait into the features array with structured automation properties so they can be immediately used in the character sheet:
   - id: Unique kebab-case identifier (e.g., "darkvision", "stonecunning", "keen-senses", "dwarven-resilience").
   - name: Trait name.
   - description: Complete trait description text.
   - category: Strictly one of ['Passive', 'Active', 'Combat', 'Utility', 'Racial Trait', 'Defense', 'Senses', 'Skills', 'Spellcasting'].
   - actionType: If trait requires an action, populate actionType: 'action' | 'bonus action' | 'reaction' (e.g., Stonecunning -> "bonus action", Breath Weapon -> "action"). Active combat traits MUST set actionType so they appear in the Actions tab!
   - senses: For Darkvision, Tremorsense, or Blindsight, extract range in feet: { darkvision: 60 } or { darkvision: 120 }, { tremorsense: 60 }.
   - proficiencies: For traits granting skill/tool proficiencies (e.g., Keen Senses: Perception): { skills: ["Perception"] }, { tools: ["Smith's tools"] }.
   - resistances: For damage resistances (e.g., Dwarven Resilience: Poison): ["Poison"], ["Fire"], ["Cold"], etc.
   - usageLimits / maxUses / sheetResourceStrip: For traits with uses (e.g., Stonecunning: PB times per Long Rest):
     maxUses: { type: "proficiencyBonus" }, usesResetOn: "long rest", sheetResourceStrip: { enabled: true }.
   - lineages / sub-species choices: When text says "Choose a lineage: High Elf, Wood Elf, or Drow" or "Choose a dragon ancestor":
     selectable: true, requiresChoice: true, speciesWizardPick: "lineagePick",
     options: [{ id: "high-elf", name: "High Elf", description: "..." }, ...],
     choices: { type: "Custom", count: 1, options: ["High Elf", "Wood Elf", "Drow"] }.
   - skill choices: When text says "proficiency in one skill of your choice":
     selectable: true, requiresChoice: true, choiceType: "skill", speciesWizardPick: "globalSkillList",
     choices: { type: "Skill", count: 1 }.
   - origin feat choices: When text says "gain one Origin feat of your choice" (e.g., Human Versatile):
     selectable: true, requiresChoice: true, choiceType: "feat", featFilter: { featType: "Origin" }.
   - spells: For spell choices or at-will spells:
     spellChoice: { count: 1, level: 0, spellList: "Wizard" } or atWillSpell: "Thaumaturgy", atWillRecharge: "atWill".
9. edition: "2024", system: "D&D 5.5e".`;

export const SPECIES_EXAMPLE_PARAGRAPH = `Elf
Creature Type: Humanoid
Size: Medium (about 5–6 feet tall)
Speed: 30 feet
Languages: Common, Elvish

Traits:
Darkvision. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.
Elven Lineage. You are part of a lineage that grants you supernatural abilities. Choose a lineage: High Elf, Wood Elf, or Drow.
Fey Ancestry. You have Advantage on saving throws you make to avoid or end the Charmed condition on yourself.
Keen Senses. You have proficiency in the Perception skill.
Trance. You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.`;
