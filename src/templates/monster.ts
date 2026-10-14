export const MONSTER_TEMPLATE = {
  _id: '68ee93a8e438bef68025fa54',
  name: 'Tiger',
  type: 'Beast',
  size: 'Large',
  alignment: 'Unaligned',
  challengeRating: '1',
  armorClass: 13,
  hitPoints: 30,
  speed: '40 ft.',
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
  senses: 'Darkvision 60 ft., Passive Perception 13',
  languages: '—',
  traits: [],
  actions: [
    {
      name: 'Rend',
      description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    },
    {
      name: 'Nimble Escape',
      description: 'The tiger takes the Disengage or Hide action.'
    }
  ],
  reactions: [],
  legendaryActions: [],
  books: [
    'Monster Manual 2024'
  ],
  proficiencyBonus: 2,
  damageResistances: '',
  damageImmunities: '',
  conditionImmunities: '',
  createdBy: 'system',
  updatedBy: 'system',
  updatedAt: '2025-11-09T00:23:59.276Z',
  createdAt: '2025-10-14T18:17:12.021Z',
  translations: {}
};

export const MONSTER_PROMPT_GUIDE = `### SPECIAL INSTRUCTIONS FOR D&D 5E MONSTERS (2024 & 2014):
1. size: Strictly one of ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].
   - NOTE ON LORE & SUMMARY TEXT: Monsters often have an atmospheric lore or summary sentence right beneath the name (e.g., "Aarakocra aeromancers control magical winds from the endless storms..."). DISCARD THIS LORE SENTENCE. Look for the true size/type line beneath it (e.g., "Medium Elemental, Neutral"). NEVER set size or type to a lore description sentence!
2. type: Creature type (e.g. 'Elemental', 'Humanoid', 'Beast', 'Monstrosity', 'Dragon', 'Fiend', 'Undead', etc.).
3. armorClass: Integer number for AC.
   - 2024 MM format: "AC 16 Initiative +3 (13)" -> extract 16.
   - 2014 MM format: "Armor Class 16 (Natural Armor)" -> extract 16.
4. hitPoints: Integer number for average HP.
   - 2024 MM format: "HP 66 (12d8 + 12)" -> extract 66.
   - 2014 MM format: "Hit Points 66 (12d8 + 12)" -> extract 66.
5. speed: String (e.g. "20 ft., Fly 50 ft." or "40 ft.").
6. abilities: Object with strength, dexterity, constitution, intelligence, wisdom, charisma (all integers 1-30).
7. challengeRating: String ("0", "1/8", "1/4", "1/2", "1", "2", "3", "4", etc.).
   - 2024 MM format: "CR 4 (XP 1,100; PB +2)" -> extract "4".
   - 2014 MM format: "Challenge 4 (1,100 XP)" -> extract "4".
8. proficiencyBonus: Integer PB (e.g. 2, 3, 4...).
9. skills: Array of proficient skills (e.g. ["Arcana +3", "Nature +5", "Perception +7"]).
10. senses: String (e.g. "Passive Perception 17" or "Darkvision 60 ft., Passive Perception 13").
11. languages: String (e.g. "Aarakocra, Primordial (Auran)").
12. actions: Array of { name: string, description: string }. Split action name and rules text cleanly.
13. reactions: Array of { name: string, description: string }. If the statblock contains a "Reactions" section (e.g. "Feather Fall (1/Day)"), extract it into the reactions array! DO NOT append reactions text to the end of actions or spellcasting!
14. books: Array of source book names (e.g. ["Monster Manual 2024"]) or book ObjectIds.
15. Ensure traits, reactions, legendaryActions, savingThrows are arrays (empty [] if not present).
16. NOISE FILTERING & ARTIFACTS:
    - DISCARD ARTIST CREDITS: Ignore standalone illustrator/artist names (e.g., "Domenico Cava", "Simon Dominic", "Craig J Spearing") that appear in the text.
    - DISCARD SPEECH BUBBLES & QUOTES: Ignore atmospheric dialogue quotes and speaker attributions (e.g. "—Feil Jenkins, Sage of Kirwak").
    - DISCARD EXPLORATION / LAIR ROLL TABLES: Ignore non-combat environmental roll tables. ONLY include tables if they are an active combat Trait or Action (such as a Beholder's Eye Rays or Wild Magic table).
    - STRIP MARKDOWN LINKS: Convert markdown links like "[Grappled](https://...)" to plain text "Grappled".
    - CATEGORY HEADERS: If the text includes umbrella category text (e.g. "Animated Objects") followed by a specific creature ("Animated Armor"), extract the specific creature stat block.`;

export const MONSTER_EXAMPLE_PARAGRAPH = `Tiger
Large Beast, Unaligned
Armor Class
13
Hit Points
30
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
