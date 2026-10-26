export const ITEM_TEMPLATE = {
  _id: '68e065e63483269c7c881820',
  name: "Thieves' Tools",
  description: 'This set of tools includes a small file, a set of lock picks, a small mirror mounted on a metal handle, a set of narrow-bladed scissors, and a pair of pliers. Proficiency with these tools lets you add your proficiency bonus to any ability checks you make to disarm traps or open locks.',
  entityType: 'tool',
  type: 'equipment',
  cost: '25 gp',
  weight: '1 lb.',
  toolType: "Thieves' Tools",
  proficiencyRequired: true,
  books: ["Player's Handbook 2024"],
  edition: '2024',
  system: 'D&D 5.5e',
  translations: {
    'pt-BR': {
      name: 'Ferramentas de Ladrão',
      description: 'Este conjunto de ferramentas inclui uma pequena lima, um conjunto de gazuas, um pequeno espelho montado em um cabo de metal, uma tesoura de lâmina estreita e um alicate. A proficiência com essas ferramentas permite adicionar seu bônus de proficiência a quaisquer testes de habilidade para desarmar armadilhas ou abrir fechaduras.',
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

export const ITEM_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D GENERAL ITEMS & ADVENTURING GEAR:
1. name: Item name (e.g., "Thieves' Tools", "Rope, Hempen (50 feet)", "Backpack", "Torch", "Potion of Healing").
2. type: Always set to "equipment" for non-magical items.
3. entityType: Choose from:
   - 'tool': artisan's tools, thieves' tools, herbalism kit, navigator's tools, poisoner's kit
   - 'kit': disguise kit, forgery kit, writing kit, climber's kit, healer's kit
   - 'utility': rope, chain, ladder, crowbar, grappling hook, pitons, hammer, magnifying glass, spyglass
   - 'camping-gear': tent, bedroll, blanket, mess kit
   - 'clothing': common clothes, fine clothes, traveler's clothes, costume, robes
   - 'light-source': torch, lantern, candle, lamp, oil flask
   - 'container': backpack, sack, pouch, chest, barrel, basket, vial, flask, waterskin
   - 'instrument': lute, flute, drum, horn, viol, lyre, bagpipes
   - 'game': dice set, playing card set, chess set, dragonchess
   - 'adventuring-gear': component pouch, arcane focus, holy symbol, druidic focus, spellbook
   - 'food-drink': rations, meal, ale, wine, water
   - 'transport': cart, wagon, carriage, rowboat, saddle, bit and bridle
   - 'other': miscellaneous non-magical gear
4. cost: Cost string with currency unit (e.g. "25 gp", "1 gp", "5 sp", "50 gp").
5. weight: Weight string with unit (e.g. "1 lb.", "10 lbs.", "1/4 lb.", "70 lbs.").
6. description: Comprehensive rules and details on the item's function.
7. edition: "2024", system: "D&D 5.5e".`;

export const ITEM_EXAMPLE_PARAGRAPH = `Thieves' Tools
Tool
Cost: 25 GP
Weight: 1 lb.

This set of tools includes a small file, a set of lock picks, a small mirror mounted on a metal handle, a set of narrow-bladed scissors, and a pair of pliers. Proficiency with these tools lets you add your proficiency bonus to any ability checks you make to disarm traps or open locks.`;
