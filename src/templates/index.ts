import { MONSTER_TEMPLATE, MONSTER_EXAMPLE_PARAGRAPH, MONSTER_PROMPT_GUIDE } from './monster';
import { SPELL_TEMPLATE, SPELL_EXAMPLE_PARAGRAPH, SPELL_PROMPT_GUIDE } from './spell';
import { MAGICAL_ITEM_TEMPLATE, MAGICAL_ITEM_EXAMPLE_PARAGRAPH, MAGICAL_ITEM_PROMPT_GUIDE } from './magicalItem';
import { SPECIES_TEMPLATE, SPECIES_EXAMPLE_PARAGRAPH, SPECIES_PROMPT_GUIDE } from './species';
import { CLASS_TEMPLATE, CLASS_EXAMPLE_PARAGRAPH, CLASS_PROMPT_GUIDE } from './class';
import { SUBCLASS_TEMPLATE, SUBCLASS_EXAMPLE_PARAGRAPH, SUBCLASS_PROMPT_GUIDE } from './subclass';
import { FEAT_TEMPLATE, FEAT_EXAMPLE_PARAGRAPH, FEAT_PROMPT_GUIDE } from './feat';
import { BACKGROUND_TEMPLATE, BACKGROUND_EXAMPLE_PARAGRAPH, BACKGROUND_PROMPT_GUIDE } from './background';
import { WEAPON_TEMPLATE, WEAPON_EXAMPLE_PARAGRAPH, WEAPON_PROMPT_GUIDE } from './weapon';
import { ITEM_TEMPLATE, ITEM_EXAMPLE_PARAGRAPH } from './item';

export interface TemplateDefinition {
  name: string;
  category: string;
  description: string;
  schema: any;
  promptGuide?: string;
  exampleParagraph: string;
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  monster: {
    name: 'monster',
    category: 'Creatures',
    description: 'D&D 5e Monster / Creature stat block with ability scores, actions, skills, and translations',
    schema: MONSTER_TEMPLATE,
    promptGuide: MONSTER_PROMPT_GUIDE,
    exampleParagraph: MONSTER_EXAMPLE_PARAGRAPH
  },
  spell: {
    name: 'spell',
    category: 'Magic',
    description: 'D&D 5e Spell definition with level, school, castingAction, components, and description',
    schema: SPELL_TEMPLATE,
    promptGuide: SPELL_PROMPT_GUIDE,
    exampleParagraph: SPELL_EXAMPLE_PARAGRAPH
  },
  'magical-item': {
    name: 'magical-item',
    category: 'Equipment',
    description: 'D&D 5e Magical Item with rarity, attunement, charges, features, and base properties',
    schema: MAGICAL_ITEM_TEMPLATE,
    promptGuide: MAGICAL_ITEM_PROMPT_GUIDE,
    exampleParagraph: MAGICAL_ITEM_EXAMPLE_PARAGRAPH
  },
  species: {
    name: 'species',
    category: 'Character Options',
    description: 'D&D 5e Species / Race with size, base speed, creature type, and categorized traits',
    schema: SPECIES_TEMPLATE,
    promptGuide: SPECIES_PROMPT_GUIDE,
    exampleParagraph: SPECIES_EXAMPLE_PARAGRAPH
  },
  class: {
    name: 'class',
    category: 'Character Options',
    description: 'D&D 5e Class with hit die, proficiencies, spellcasting, and level progression',
    schema: CLASS_TEMPLATE,
    promptGuide: CLASS_PROMPT_GUIDE,
    exampleParagraph: CLASS_EXAMPLE_PARAGRAPH
  },
  subclass: {
    name: 'subclass',
    category: 'Character Options',
    description: 'D&D 5e Subclass archetype linked to parent class with features by level and spell lists',
    schema: SUBCLASS_TEMPLATE,
    promptGuide: SUBCLASS_PROMPT_GUIDE,
    exampleParagraph: SUBCLASS_EXAMPLE_PARAGRAPH
  },
  feat: {
    name: 'feat',
    category: 'Character Options',
    description: 'D&D 5e Feat with featType, prerequisites, ability score increases, and feature benefits',
    schema: FEAT_TEMPLATE,
    promptGuide: FEAT_PROMPT_GUIDE,
    exampleParagraph: FEAT_EXAMPLE_PARAGRAPH
  },
  background: {
    name: 'background',
    category: 'Character Options',
    description: 'D&D 5e Background with origin feat, ability scores, proficiencies, and equipment',
    schema: BACKGROUND_TEMPLATE,
    promptGuide: BACKGROUND_PROMPT_GUIDE,
    exampleParagraph: BACKGROUND_EXAMPLE_PARAGRAPH
  },
  weapon: {
    name: 'weapon',
    category: 'Equipment',
    description: 'D&D 5e Weapon with category, damage dice, damageType, properties, and 2024 masteries',
    schema: WEAPON_TEMPLATE,
    promptGuide: WEAPON_PROMPT_GUIDE,
    exampleParagraph: WEAPON_EXAMPLE_PARAGRAPH
  },
  item: {
    name: 'item',
    category: 'Equipment',
    description: 'D&D 5e General Item / Gear with cost, weight, and description',
    schema: ITEM_TEMPLATE,
    exampleParagraph: ITEM_EXAMPLE_PARAGRAPH
  }
};

// Aliases
TEMPLATES['magicalitem'] = TEMPLATES['magical-item'];
TEMPLATES['magic-item'] = TEMPLATES['magical-item'];
TEMPLATES['race'] = TEMPLATES['species'];

export function getTemplate(name: string): TemplateDefinition | undefined {
  if (!name) return undefined;
  return TEMPLATES[name.toLowerCase().trim()];
}

export function listTemplates(): TemplateDefinition[] {
  // Return unique templates without duplicates from aliases
  const seen = new Set<string>();
  const list: TemplateDefinition[] = [];
  for (const t of Object.values(TEMPLATES)) {
    if (!seen.has(t.name)) {
      seen.add(t.name);
      list.push(t);
    }
  }
  return list;
}

export * from './monster';
export * from './spell';
export * from './magicalItem';
export * from './species';
export * from './class';
export * from './subclass';
export * from './feat';
export * from './background';
export * from './weapon';
export * from './item';
