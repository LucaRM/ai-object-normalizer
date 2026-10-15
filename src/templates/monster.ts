export const MONSTER_TEMPLATE = {
  _id: '68ee93a8e438bef68025fa54',
  name: 'Tiger',
  type: 'Beast',
  customType: 'Large Beast',
  size: 'Large',
  alignment: 'Unaligned',
  challengeRating: '1',
  armorClass: 13,
  armorClassType: '',
  initiative: '+3 (13)',
  initiativeBonus: 3,
  hitPoints: 30,
  hitDie: '4d10 + 8',
  speed: {
    walk: 40
  },
  abilities: {
    strength: 17,
    dexterity: 16,
    constitution: 14,
    intelligence: 3,
    wisdom: 12,
    charisma: 8
  },
  skills: [
    'Perception +3',
    'Stealth +7'
  ],
  savingThrows: [],
  damageResistances: [],
  damageImmunities: [],
  damageVulnerabilities: [],
  conditionImmunities: [],
  senses: 'Darkvision 60 ft., Passive Perception 13',
  passivePerception: 13,
  languages: '—',
  gear: [],
  traits: [],
  actions: [
    {
      name: 'Rend',
      description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.',
      type: 'attack',
      attackType: 'melee',
      attackBonus: 5,
      reach: '5 ft.',
      damage: '2d6 + 3',
      damageType: 'slashing',
      averageDamage: 10,
      condition: 'Prone'
    },
    {
      name: 'Nimble Escape',
      description: 'The tiger takes the Disengage or Hide action.',
      type: 'utility'
    }
  ],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  books: [
    'Monster Manual 2024'
  ],
  proficiencyBonus: 2,
  createdBy: 'system',
  updatedBy: 'system',
  updatedAt: '2025-11-09T00:23:59.276Z',
  createdAt: '2025-10-14T18:17:12.021Z',
  translations: {}
};

export const MONSTER_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D 5E MONSTERS (2024 & 2014) AUTOMATION SCHEMA:
1. size: Strictly one of ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].
   - NOTE ON LORE & SUMMARY TEXT: Monsters often have an atmospheric lore sentence right beneath the name. DISCARD THIS LORE SENTENCE. Look for the true size/type line beneath it (e.g., "Medium Elemental, Neutral").
2. type: Primary creature type (e.g. 'Elemental', 'Humanoid', 'Beast', 'Monstrosity', 'Dragon', 'Fiend', 'Undead'). Strip prefixes like "or " or "Medium or Small".
3. customType: Full raw size/type description (e.g. "Huge Fiend (Demon)", "Medium or Small Humanoid").
4. armorClass: Integer AC (e.g. 19). armorClassType: optional description (e.g. "Natural Armor", "(Chain Mail, Shield)").
5. hitPoints: Integer average HP (e.g. 287). hitDie: roll formula string (e.g. "23d12 + 138" from "HP 287 (23d12 + 138)").
6. initiative: String modifier & score (e.g. "+14 (24)"). initiativeBonus: Integer number (e.g. 14).
7. speed: Object with numeric speeds: { walk?: number, fly?: number, swim?: number, climb?: number, burrow?: number, hover?: boolean }. E.g. "Speed 40 ft., Fly 80 ft." -> { walk: 40, fly: 80 }.
8. abilities: Object with strength, dexterity, constitution, intelligence, wisdom, charisma (integers 1-30).
9. challengeRating: String ("0", "1/8", "1/4", "1/2", "1", "2", "3", etc.). proficiencyBonus: Integer PB (e.g. 2, 6).
10. savingThrows: Array of proficient saving throw strings (e.g. ["Dex +9", "Wis +11"]).
11. skills: Array of proficient skills (e.g. ["Arcana +3", "Nature +5", "Perception +7"]).
12. damageResistances: Array of resistance strings (e.g. ["Cold", "Fire"]).
13. damageImmunities: Array of damage immunity strings (e.g. ["Fire", "Poison"]).
14. damageVulnerabilities: Array of vulnerability strings (e.g. ["Radiant"]).
15. conditionImmunities: Array of condition immunity strings (e.g. ["Charmed", "Exhaustion", "Frightened"]).
16. senses: String (e.g. "Truesight 120 ft.; Passive Perception 19"). passivePerception: Integer (e.g. 19).
17. languages: String (e.g. "Abyssal; telepathy 120 ft.").
18. gear: Array of equipment strings (e.g. ["Pistol", "Scimitar", "Studded Leather Armor"]).
19. legendaryActionUses: Integer count if legendary actions are present (e.g. 3).
20. traits, actions, bonusActions, reactions, legendaryActions: Array of structured action objects:
    - name: Action title (e.g. "Spectral Claw", "Bite", "Multiattack", "Crackling Wave")
    - description: Full verbatim rules text (e.g. "Melee Attack Roll: +14, reach 10 ft. Hit: 17 (3d6 + 7) Force damage.")
    - type: 'attack' | 'save' | 'multiattack' | 'spellcasting' | 'utility'
    - attackType: 'melee' | 'ranged' | 'melee_or_ranged' (for attacks)
    - attackBonus: Integer to-hit bonus (e.g. 14)
    - reach: String (e.g. "10 ft.")
    - range: String (e.g. "60 ft." or "80/320 ft.")
    - damage: Primary damage formula string (e.g. "3d6 + 7")
    - damageType: Lowercase primary damage type (e.g. "force", "slashing", "fire")
    - averageDamage: Integer average damage (e.g. 17)
    - secondaryDamage: Optional secondary damage formula (e.g. "5d6")
    - secondaryDamageType: Optional secondary damage type (e.g. "fire")
    - secondaryAverageDamage: Optional secondary average damage (e.g. 17)
    - hasSavingThrow: Boolean (true if action forces a saving throw)
    - saveAbility: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
    - saveDc: Integer DC (e.g. 22)
    - saveSuccess: 'half' | 'none'
    - area: String area (e.g. "60-foot Cone", "30-foot Emanation")
    - condition: Condition imposed (e.g. "Prone", "Cursed", "Grappled")
    - riderEffect: Brief rider effect text (e.g. "pull up to 25 ft.")
    - multiattack: Array of attack names used in Multiattack (e.g. ["Flame Whip", "Lightning Blade"])
    - cost: Legendary action action cost (e.g. 1 or 2)
    - spells: { atWill?: string[], perDay?: { count: number, spells: string[] }[] }`;

export const MONSTER_EXAMPLE_PARAGRAPH = `Tiger
Large Beast, Unaligned
Armor Class
13
Hit Points
30 (4d10 + 8)
Speed:
40 ft. (8 spaces)
Mod	Save
STR	17	+3	+3
DEX	16	+3	+3
CON	14	+2	+2
Mod	Save
INT	3	-4	-4
WIS	12	+1	+1
CHA	8	-1	-1
Skills
Perception +3, Stealth +7
Senses
Darkvision 60 ft., Passive Perception 13
Languages
—
Challenge
1 (2 PB)
Actions
Rend. Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.
Nimble Escape. The tiger takes the Disengage or Hide action.`;
