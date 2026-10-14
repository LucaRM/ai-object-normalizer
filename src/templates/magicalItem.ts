export const MAGICAL_ITEM_TEMPLATE = {
  _id: '68e065e63483269c7c881850',
  name: 'Flame Tongue Greatsword',
  description: "You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade. These flames shed bright light in a 40-foot radius and dim light for an additional 40 feet. While the sword is ablaze, it deals an extra 2d6 fire damage to any target it hits. The flames last until you use a bonus action to speak the command word again or until you drop or sheathe the sword.",
  entityType: 'weapon',
  type: 'magic-item',
  rarity: 'rare',
  requiresAttunement: true,
  baseItem: 'Greatsword',
  baseItemType: 'weapon',
  weaponType: 'Martial Melee',
  damage: '2d6',
  damageType: 'slashing',
  properties: ['Heavy', 'Two-Handed'],
  features: [
    {
      name: 'Flame Tongue',
      description: 'As a bonus action, speak the command word to ignite the blade for +2d6 fire damage and bright light in a 40-foot radius.',
      type: 'active'
    }
  ],
  maxCharges: 0,
  chargeResetOn: 'Never',
  books: ["Dungeon Master's Guide 2024"],
  system: 'dnd5e',
  translations: {
    'pt-BR': {
      name: 'Espada Larga Língua de Fogo',
      description: 'Você pode usar uma ação bônus para pronunciar a palavra de comando desta espada mágica, fazendo com que chamas irrompam da lâmina...',
      features: [
        {
          name: 'Língua de Fogo',
          description: 'Com uma ação bônus, pronuncie a palavra de comando para inflamar a lâmina causando +2d6 de dano de fogo adicional.'
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

export const MAGICAL_ITEM_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR MAGICAL ITEMS:
1. entityType: Choose from ['weapon', 'armor', 'wondrous', 'ring', 'rod', 'staff', 'wand', 'potion', 'scroll', 'other'].
2. rarity: Must be strictly lowercase: 'common', 'uncommon', 'rare', 'very rare', 'legendary', or 'artifact'.
3. requiresAttunement: Set to true if the item mentions "requires attunement", otherwise false.
4. type: Always set to "magic-item".
5. features: Extract every distinct named ability or power into the features array with { name, description, type?: 'passive' | 'active' | 'charged' | 'attunement', usesPerDay?, charges? }.
6. charge management: If the item uses charges (e.g. 7 charges, regains 1d6+1 daily at dawn), extract maxCharges (number), chargeResetOn ('Dawn'|'Dusk'|'Short Rest'|'Long Rest'|'Never'), and chargeRegeneration (string).
7. If the item is a weapon or armor, extract baseItem, weaponType/armorType, damage, damageType, and properties.`;

export const MAGICAL_ITEM_EXAMPLE_PARAGRAPH = `Flame Tongue
Weapon (any sword), rare (requires attunement)
You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade. These flames shed bright light in a 40-foot radius and dim light for an additional 40 feet. While the sword is ablaze, it deals an extra 2d6 fire damage to any target it hits. The flames last until you use a bonus action to speak the command word again or until you drop or sheathe the sword.`;
