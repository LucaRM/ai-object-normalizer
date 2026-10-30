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
  magicBonusToHit: 0,
  magicBonusToDamage: 0,
  extraDamage: '2d6',
  extraDamageType: 'fire',
  armorClassBonus: 0,
  savingThrowBonus: 0,
  spells: [],
  features: [
    {
      name: 'Flame Tongue',
      description: 'As a bonus action, speak the command word to ignite the blade for +2d6 fire damage and bright light in a 40-foot radius.',
      type: 'active',
      actionType: 'bonus action',
      saveDC: null,
      saveAbility: null,
      maxUses: null,
      usesRecharge: null
    }
  ],
  maxCharges: 0,
  chargeResetOn: 'Never',
  chargeRegeneration: null,
  usesRecharge: null,
  books: ["Dungeon Master's Guide 2024"],
  edition: '2024',
  system: 'D&D 5.5e',
  translations: {
    'pt-BR': {
      name: 'Espada Larga Língua de Fogo',
      description: 'Você pode usar uma ação bônus para pronunciar a palavra de comando desta espada mágica, fazendo com que chamas irrompam da lâmina...',
      features: [
        {
          name: 'Língua de Fogo',
          description: 'Com uma ação bônus, pronuncie a palavra de comando para inflamar a lâmina causando +2d6 de dano de fogo adicional.',
          actionType: 'bonus action'
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
5. Attack & Damage Bonuses (Weapons):
   - magicBonusToHit: Number (e.g. 1 for +1 weapon, 2 for +2, 3 for +3; or 0 if none).
   - magicBonusToDamage: Number (e.g. 1, 2, 3; or 0 if none).
   - extraDamage: Dice string if weapon deals additional magical damage on hit (e.g. "2d6" for Flame Tongue, "1d6" for Frost Brand), otherwise null.
   - extraDamageType: Damage type of extra damage (e.g. "fire", "cold", "radiant", "necrotic"), otherwise null.
6. Armor & Protection Bonuses (Armor, Shields, Rings, Cloaks):
   - armorClassBonus: Number representing bonus to AC (e.g. 1 for +1 Shield or Ring/Cloak of Protection; or 0 if none).
   - savingThrowBonus: Number representing bonus to all saving throws (e.g. 1 for Ring/Cloak of Protection; or 0 if none).
7. Spellcasting from Items:
   - spells: Array of spell names granted or castable from the item (e.g. ["Magic Missile"] for Wand of Magic Missile, ["Invisibility"] for Ring of Invisibility). If none, empty array [].
8. Item Features & Action Economy (Crucial for Character Sheet Automation):
   Extract every distinct ability or power into features array with:
   - name: Feature name (e.g. "Flame Tongue", "Poison Coating", "Produce Liquid")
   - description: Feature description
   - type: 'active' | 'passive' | 'charged' | 'attunement'
   - actionType: Action economy for character sheet button: 'action' | 'bonus action' | 'reaction' | 'special' | 'passive'.
     * 'bonus action': If text specifies "Bonus Action" (e.g. "You can take a Bonus Action...", "As a bonus action...")
     * 'action': If text specifies "Action" or "Magic action" (e.g. "You can take a Magic action to expend...", "As an action...")
     * 'reaction': If text specifies "Reaction" (e.g. "When you take damage, you can take a Reaction...")
     * 'special': Non-standard action economy
     * 'passive': Passive trait or ongoing benefit with no activation cost
   - saveDC: Number if feature imposes a saving throw (e.g. 15 for DC 15 save), otherwise null.
   - saveAbility: Ability score for saving throw in lowercase ('strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'), otherwise null.
   - usesPerDay: Number if limited uses per day (e.g. 1 for 1/day).
   - charges: Charge cost to activate.
   - maxUses: Static number or formula object ({ type: "proficiencyBonus" }) if feature has limited uses.
   - usesRecharge: Structured trigger recovery object ({ "longRest": "all" }, { "shortRest": "all" }, { "dawn": "all" }, etc.).
9. Charge Management & Uses Recharge (Wands, Staffs, Charged Items):
   - maxCharges: Integer (e.g. 7 for Wand of Magic Missiles, 10 for Staff of the Woodlands, or 0 if no charges).
   - chargeResetOn: 'dawn' | 'dusk' | 'shortRest' | 'longRest' | 'Never'.
   - chargeRegeneration: Raw text describing recharge rate (e.g. "1d6 + 1 expended charges daily at dawn" or "regains 1 charge daily at dawn").
   - usesRecharge: Structured recharge trigger object:
     * { "dawn": { "dice": { "count": 1, "die": 6 }, "flat": 1 } } for 1d6 + 1 at dawn
     * { "dawn": "all" } for regains all charges at dawn
     * { "dawn": 1 } for 1 charge daily at dawn
     * { "longRest": "all" } for regains all charges on a long rest
     * { "shortRest": "all" } for short rest recovery
10. Base Weapon & Armor Extraction:
   - If the item is a weapon, extract baseItem from parentheses (e.g. "Weapon (dagger)" -> baseItem: "Dagger", damage: "1d4", damageType: "piercing", properties: ["Finesse", "Light", "Thrown"]). Do NOT default to Greatsword unless it is actually a greatsword.
11. edition: "2024", system: "D&D 5.5e".`;

export const MAGICAL_ITEM_EXAMPLE_PARAGRAPH = `Flame Tongue
Weapon (any sword), rare (requires attunement)
You can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade. These flames shed bright light in a 40-foot radius and dim light for an additional 40 feet. While the sword is ablaze, it deals an extra 2d6 fire damage to any target it hits. The flames last until you use a bonus action to speak the command word again or until you drop or sheathe the sword.`;
