/**
 * Parser for D&D 5e / 2024 monster actions, attacks, spells, and features.
 * Transforms raw description text into rich interactive action objects.
 */

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing'
];

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled',
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned',
  'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Cursed'
];

export interface ParsedMonsterAction {
  name: string;
  description: string;
  type?: 'attack' | 'save' | 'multiattack' | 'spellcasting' | 'utility';
  attackType?: 'melee' | 'ranged' | 'melee_or_ranged';
  attackBonus?: number;
  reach?: string;
  range?: string;
  damage?: string;
  damageType?: string;
  averageDamage?: number;
  secondaryDamage?: string;
  secondaryDamageType?: string;
  secondaryAverageDamage?: number;
  hasSavingThrow?: boolean;
  saveAbility?: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
  saveDc?: number;
  saveSuccess?: 'half' | 'none';
  area?: string;
  condition?: string;
  riderEffect?: string;
  multiattack?: string[];
  cost?: number;
  recharge?: string;
  spellcastingAbility?: string;
  spellSaveDc?: number;
  spellAttackBonus?: number;
  spells?: {
    atWill?: string[];
    perDay?: { count: number; spells: string[] }[];
  };
}

export class MonsterActionParser {
  /**
   * Parses an action entry and enriches it with combat automation fields
   */
  static parseAction(entry: { name: string; description: string; [key: string]: any }, category: string = 'actions'): ParsedMonsterAction {
    const name = (entry.name || '').trim();
    const desc = (entry.description || '').trim();

    // Preserve any existing fields already present on the entry
    const action: ParsedMonsterAction = {
      ...entry,
      name,
      description: desc
    };

    // 1. Classification
    if (!action.type) {
      if (/^multiattack\b/i.test(name) || /makes\s+(?:one|two|three|four|\d+)\s+attacks/i.test(desc)) {
        action.type = 'multiattack';
      } else if (/spellcasting/i.test(name) || /casts\s+one\s+of\s+the\s+following\s+spells/i.test(desc)) {
        action.type = 'spellcasting';
      } else if (/(?:melee\s+or\s+ranged|melee|ranged)\s+(?:attack\s+roll|weapon\s+attack|spell\s+attack)/i.test(desc)) {
        action.type = 'attack';
      } else if (/(?:saving\s+throw|each\s+creature\s+in\s+a\s+[^\n.]+takes?\s+\d+)/i.test(desc)) {
        action.type = 'save';
      } else {
        action.type = 'utility';
      }
    }

    // 2. Attack Rolls
    if (action.type === 'attack') {
      if (!action.attackType) {
        if (/melee\s+or\s+ranged/i.test(desc)) {
          action.attackType = 'melee_or_ranged';
        } else if (/melee/i.test(desc)) {
          action.attackType = 'melee';
        } else if (/ranged/i.test(desc)) {
          action.attackType = 'ranged';
        }
      }

      if (action.attackBonus === undefined) {
        const bonusMatch = desc.match(/(?:Attack\s+Roll|Weapon\s+Attack|Spell\s+Attack):\s*([+\-]?\d+)/i) ||
                           desc.match(/([+\-]\d+)\s+to\s+hit/i);
        if (bonusMatch) {
          action.attackBonus = parseInt(bonusMatch[1], 10);
        }
      }

      if (!action.reach) {
        const reachMatch = desc.match(/reach\s*(\d+\s*ft\.?)/i);
        if (reachMatch) {
          action.reach = reachMatch[1].trim();
        }
      }

      if (!action.range) {
        const rangeMatch = desc.match(/range\s*(\d+(?:\/\d+)?\s*ft\.?)/i);
        if (rangeMatch) {
          action.range = rangeMatch[1].trim();
        }
      }
    }

    // Range on non-attacks (e.g. Teleport, Witch Strike)
    if (!action.range && !action.reach) {
      const rangeMatch = desc.match(/(?:within|up\s+to)\s+(\d+\s*ft\.?)/i);
      if (rangeMatch) {
        action.range = rangeMatch[1].trim();
      }
    }

    // 3. Primary & Secondary Damage
    if (action.damage === undefined) {
      const dmgRegex = /(?:Hit|Failure|takes?):\s*(\d+)\s*(?:\(([^)]+)\))?\s*([A-Za-z]+)\s+damage(?:\s+(?:plus|and)\s+(\d+)\s*(?:\(([^)]+)\))?\s*([A-Za-z]+)\s+damage)?/i;
      const dmgMatch = desc.match(dmgRegex);
      if (dmgMatch) {
        action.averageDamage = parseInt(dmgMatch[1], 10);
        if (dmgMatch[2]) action.damage = dmgMatch[2].trim();
        if (dmgMatch[3] && DAMAGE_TYPES.includes(dmgMatch[3].toLowerCase())) {
          action.damageType = dmgMatch[3].toLowerCase();
        }

        if (dmgMatch[4]) {
          action.secondaryAverageDamage = parseInt(dmgMatch[4], 10);
          if (dmgMatch[5]) action.secondaryDamage = dmgMatch[5].trim();
          if (dmgMatch[6] && DAMAGE_TYPES.includes(dmgMatch[6].toLowerCase())) {
            action.secondaryDamageType = dmgMatch[6].toLowerCase();
          }
        }
      } else {
        // Fallback damage match: e.g. "take 15 (2d6 + 8) Bludgeoning damage"
        const fallbackDmg = desc.match(/(?:take|takes|dealing|deals)\s*(\d+)\s*(?:\(([^)]+)\))?\s*([A-Za-z]+)\s+damage/i);
        if (fallbackDmg) {
          action.averageDamage = parseInt(fallbackDmg[1], 10);
          if (fallbackDmg[2]) action.damage = fallbackDmg[2].trim();
          if (fallbackDmg[3] && DAMAGE_TYPES.includes(fallbackDmg[3].toLowerCase())) {
            action.damageType = fallbackDmg[3].toLowerCase();
          }
        }
      }
    }

    // 4. Saving Throws
    if (action.hasSavingThrow === undefined) {
      const saveMatch = desc.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving\s+Throw:\s*DC\s*(\d+)/i) ||
                        desc.match(/DC\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
      if (saveMatch) {
        action.hasSavingThrow = true;
        if (isNaN(parseInt(saveMatch[1], 10))) {
          action.saveAbility = saveMatch[1].toLowerCase() as any;
          action.saveDc = parseInt(saveMatch[2], 10);
        } else {
          action.saveDc = parseInt(saveMatch[1], 10);
          action.saveAbility = saveMatch[2].toLowerCase() as any;
        }

        if (/success:\s*half\s+damage/i.test(desc) || /or\s+half\s+as\s+much\s+damage/i.test(desc)) {
          action.saveSuccess = 'half';
        } else {
          action.saveSuccess = 'none';
        }
      }
    }

    // Area
    if (!action.area) {
      const areaMatch = desc.match(/(?:in|originating\s+from[^\n.]+in)\s+a\s+([^\n,.]*?(?:Cone|Line|Sphere|Cube|Cylinder|Emanation|radius))/i) ||
                        desc.match(/(\d+[\s-]*foot\s+(?:Cone|Line|Sphere|Cube|Cylinder|Emanation|radius))/i);
      if (areaMatch) {
        action.area = areaMatch[1].trim();
      }
    }

    // 5. Conditions & Riders
    if (!action.condition) {
      for (const cond of CONDITIONS) {
        const condRegex = new RegExp(`\\b${cond}\\b(?:\\s+condition)?`, 'i');
        if (condRegex.test(desc)) {
          action.condition = cond;
          break;
        }
      }
    }

    if (!action.riderEffect) {
      if (/pulls?\s+(?:the\s+target\s+)?up\s+to\s+\d+\s+feet/i.test(desc)) {
        const pullMatch = desc.match(/pulls?\s+(?:the\s+target\s+)?up\s+to\s+(\d+\s+feet)/i);
        action.riderEffect = pullMatch ? `pull up to ${pullMatch[1]}` : 'pull';
      } else if (/can’t\s+take\s+reactions|cannot\s+take\s+reactions/i.test(desc)) {
        action.riderEffect = "target can't take Reactions";
      }
    }

    // 6. Multiattack sub-attacks
    if (action.type === 'multiattack' && !action.multiattack) {
      const multiMatch = desc.match(/makes\s+(?:one|two|three|four|\d+)\s+([A-Za-z\s'\u2019]+?)\s+attacks?\s+and\s+(?:one|two|\d+)?\s*([A-Za-z\s'\u2019]+?)(?:\s+attacks?|\s+in\s+any\s+combination|\.|$)/i);
      if (multiMatch) {
        action.multiattack = [multiMatch[1].trim(), multiMatch[2].trim()];
      }
    }

    // 7. Costs (for legendary actions)
    if (category === 'legendaryActions' && (action.cost === undefined || action.cost === 0)) {
      const costMatch = name.match(/\((?:Costs?\s+)?(\d+)\s+actions?\)/i) || desc.match(/\bcosts?\s+(\d+)\s+actions?\b/i);
      action.cost = costMatch ? parseInt(costMatch[1], 10) : 1;
    }

    // Recharge
    if (!action.recharge) {
      const rechargeMatch = name.match(/recharge\s*(\d+[–\-]\d+)/i) || desc.match(/recharge\s*(\d+[–\-]\d+)/i);
      if (rechargeMatch) {
        action.recharge = rechargeMatch[1].replace('–', '-');
      }
    }

    // 8. Spellcasting
    if (action.type === 'spellcasting') {
      if (action.spellSaveDc === undefined) {
        const dcMatch = desc.match(/spell\s+save\s+DC\s*(\d+)/i);
        if (dcMatch) action.spellSaveDc = parseInt(dcMatch[1], 10);
      }

      if (!action.spellcastingAbility) {
        const abMatch = desc.match(/using\s+(Charisma|Intelligence|Wisdom)\s+as\s+the\s+spellcasting\s+ability/i);
        if (abMatch) action.spellcastingAbility = abMatch[1].toLowerCase();
      }

      if (!action.spells) {
        const spellsObj: any = {};
        const atWillMatch = desc.match(/at\s+will:\s*([^\n;]+)/i);
        if (atWillMatch) {
          spellsObj.atWill = atWillMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        }

        const perDayMatches = [...desc.matchAll(/(\d+)\/day(?:\s+each)?:\s*([^\n;]+)/gi)];
        if (perDayMatches.length > 0) {
          spellsObj.perDay = perDayMatches.map(m => ({
            count: parseInt(m[1], 10),
            spells: m[2].split(',').map(s => s.trim()).filter(Boolean)
          }));
        }
        if (Object.keys(spellsObj).length > 0) {
          action.spells = spellsObj;
        }
      }
    }

    return action;
  }
}
