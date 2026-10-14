import { NormalizerProvider, NormalizeOptions } from '../types';
import { MONSTER_TEMPLATE } from '../templates/monster';

export class MockProvider implements NormalizerProvider {
  public name = 'Mock';
  private available = true;

  constructor(available: boolean = true) {
    this.available = available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(state: boolean): void {
    this.available = state;
  }

  async normalize(text: string, schema: any, options: NormalizeOptions): Promise<string> {
    // 0. Sectional sub-schemas (chunked monster extraction)
    if (schema && schema.traits !== undefined && schema.armorClass === undefined) {
      return this.extractSectionalTraits(text);
    }
    if (schema && schema.reactions !== undefined && schema.actions === undefined && schema.armorClass === undefined) {
      return this.extractSectionalReactions(text);
    }
    if (schema && (schema.actions !== undefined || schema.reactions !== undefined) && schema.armorClass === undefined) {
      return this.extractSectionalActions(text);
    }
    if (schema && schema.legendaryActions !== undefined && schema.armorClass === undefined) {
      return this.extractSectionalLegendary(text);
    }

    const tmpl = (options.template || '').toLowerCase().trim();

    // 1. Monster
    if (tmpl === 'monster' || text.toLowerCase().includes('tiger') || text.toLowerCase().includes('armor class')) {
      return this.extractMonsterStatBlock(text, schema, options);
    }

    // 2. Spell
    if (tmpl === 'spell' || text.toLowerCase().includes('casting time') || text.toLowerCase().includes('evocation')) {
      return this.extractSpell(text, schema, options);
    }

    // 3. Magical Item
    if (tmpl === 'magical-item' || tmpl === 'magicalitem' || text.toLowerCase().includes('wondrous item') || text.toLowerCase().includes('requires attunement')) {
      return this.extractMagicalItem(text, schema, options);
    }

    // 4. Species
    if (tmpl === 'species' || tmpl === 'race' || text.toLowerCase().includes('creature type:') || text.toLowerCase().includes('fey ancestry')) {
      return this.extractSpecies(text, schema, options);
    }

    // 5. Class
    if (tmpl === 'class' || text.toLowerCase().includes('hit point die:') || text.toLowerCase().includes('action surge')) {
      return this.extractClass(text, schema, options);
    }

    // 6. Subclass
    if (tmpl === 'subclass' || text.toLowerCase().includes('subclass') || text.toLowerCase().includes('improved critical')) {
      return this.extractSubclass(text, schema, options);
    }

    // 7. Feat
    if (tmpl === 'feat' || text.toLowerCase().includes('prerequisite:')) {
      return this.extractFeat(text, schema, options);
    }

    // 8. Background
    if (tmpl === 'background' || text.toLowerCase().includes('gaming set') || text.toLowerCase().includes('soldier')) {
      return this.extractBackground(text, schema, options);
    }

    // 9. Weapon
    if (tmpl === 'weapon' || text.toLowerCase().includes('versatile') || text.toLowerCase().includes('mastery:')) {
      return this.extractWeapon(text, schema, options);
    }

    // Generic heuristic normalization
    return this.extractGenericObject(text, schema, options);
  }

  private extractSpell(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Fireball';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Fireball' ? 'Bola de Fogo' : name,
          description: 'Um raio brilhante lampeja do seu dedo indicador...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractMagicalItem(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Flame Tongue';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Flame Tongue' ? 'Língua de Fogo' : name,
          description: 'Você pode usar uma ação bônus para pronunciar a palavra de comando...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractSpecies(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Elf';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Elf' ? 'Elfo' : name,
          description: 'Elfos são um povo mágico de graça sobrenatural...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractClass(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Fighter';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Fighter' ? 'Guerreiro' : name,
          description: 'Guerreiros dominam as artes marciais...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractSubclass(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Champion';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Champion' ? 'Campeão' : name,
          description: 'O protótipo do Campeão concentra-se no desenvolvimento do poder físico...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractFeat(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Great Weapon Master';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Great Weapon Master' ? 'Mestre em Armas Grandes' : name,
          description: 'Você aprendeu a usar o peso de uma arma a seu favor...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractBackground(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Soldier';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Soldier' ? 'Soldado' : name,
          description: 'Você começou a treinar para a guerra assim que teve idade...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractWeapon(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Longsword';
    const clone = { ...schema, name };
    if (options.targetLocale === 'pt-BR') {
      clone.translations = {
        'pt-BR': {
          name: name === 'Longsword' ? 'Espada Longa' : name,
          description: 'A proficiência com uma Espada Longa permite...',
          _metadata: { locale: 'pt-BR', translatedAt: new Date().toISOString(), source: 'AI_TRANSLATION', quality: 'DRAFT' },
          metadata: { reviewed: false, translatedBy: 'ai' }
        }
      };
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractMonsterStatBlock(text: string, schema: any, options: NormalizeOptions): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || 'Unknown Creature';

    // Size & Type & Alignment (skips preceding lore sentences like "Aarakocra aeromancers control...")
    let size = 'Medium';
    let type = 'Beast';
    let alignment = 'Unaligned';

    for (let i = 1; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      const match = line.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+)(?:,\s*(.+))?$/i);
      if (match) {
        size = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        type = match[2].trim();
        if (match[3]) alignment = match[3].trim();
        break;
      }
    }

    // AC: Matches "Armor Class 16", "AC 16", "AC 16 Initiative +3 (13)"
    const acMatch = text.match(/(?:Armor Class|AC)\s*[\n:]?\s*(\d+)/i);
    const armorClass = acMatch ? parseInt(acMatch[1], 10) : 10;

    // HP: Matches "Hit Points 66", "HP 66 (12d8 + 12)"
    const hpMatch = text.match(/(?:Hit Points|HP)\s*[\n:]?\s*(\d+)/i);
    const hitPoints = hpMatch ? parseInt(hpMatch[1], 10) : 10;

    // Speed
    const speedMatch = text.match(/Speed:?\s*([^\n]+)/i);
    const speed = speedMatch ? speedMatch[1].trim() : '30 ft.';

    // Abilities (case-insensitive for STR/Str, DEX/Dex, etc.)
    const abilities: Record<string, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10
    };

    const strMatch = text.match(/\bSTR\b\s*(\d+)/i);
    if (strMatch) abilities.strength = parseInt(strMatch[1], 10);
    const dexMatch = text.match(/\bDEX\b\s*(\d+)/i);
    if (dexMatch) abilities.dexterity = parseInt(dexMatch[1], 10);
    const conMatch = text.match(/\bCON\b\s*(\d+)/i);
    if (conMatch) abilities.constitution = parseInt(conMatch[1], 10);
    const intMatch = text.match(/\bINT\b\s*(\d+)/i);
    if (intMatch) abilities.intelligence = parseInt(intMatch[1], 10);
    const wisMatch = text.match(/\bWIS\b\s*(\d+)/i);
    if (wisMatch) abilities.wisdom = parseInt(wisMatch[1], 10);
    const chaMatch = text.match(/\bCHA\b\s*(\d+)/i);
    if (chaMatch) abilities.charisma = parseInt(chaMatch[1], 10);

    // Skills
    const skillsMatch = text.match(/Skills\s*[\n:]?\s*([^\n]+)/i);
    const skills = skillsMatch ? skillsMatch[1].split(',').map(s => s.trim()) : [];

    // Senses
    const sensesMatch = text.match(/Senses\s*[\n:]?\s*([^\n]+)/i);
    const senses = sensesMatch ? sensesMatch[1].trim() : 'Passive Perception 10';

    // Languages
    const langMatch = text.match(/Languages\s*[\n:]?\s*([^\n]+)/i);
    const languages = langMatch ? langMatch[1].trim() : '—';

    // Challenge / CR: Matches "Challenge 4", "CR 4", "CR 4 (XP 1,100; PB +2)"
    const crMatch = text.match(/(?:Challenge|CR)\s*[\n:]?\s*(\d+(?:\/\d+)?)/i);
    const challengeRating = crMatch ? crMatch[1] : '1';

    // Actions & Reactions (Cleanly bounded to avoid leaking or cutting off at section headers)
    const actions: Array<{ name: string; description: string }> = [];
    const reactions: Array<{ name: string; description: string }> = [];

    function parseNamedEntries(sectionContent: string): Array<{ name: string; description: string }> {
      const items: Array<{ name: string; description: string }> = [];
      const blocks = sectionContent
        .split(/(?=\n[A-Z][A-Za-z0-9'\s\(\)\/\-]+?\.\s)/g)
        .map(b => b.trim())
        .filter(Boolean);

      for (const block of blocks) {
        const dotIdx = block.indexOf('.');
        if (dotIdx > 0) {
          const actName = block.substring(0, dotIdx).trim();
          const actDesc = block.substring(dotIdx + 1).trim();
          if (actName && actDesc) {
            items.push({ name: actName, description: actDesc });
          }
        }
      }
      return items;
    }

    const actionsHeading = text.match(/(?:^|\n)(?:Actions|###\s*Actions|\*\*Actions\*\*)\s*(?:\n|$)/i);
    const reactionsHeading = text.match(/(?:^|\n)(?:Reactions|###\s*Reactions|\*\*Reactions\*\*)\s*(?:\n|$)/i);
    const bonusHeading = text.match(/(?:^|\n)(?:Bonus\s+Actions|###\s*Bonus\s+Actions|\*\*Bonus\s+Actions\*\*)\s*(?:\n|$)/i);
    const legHeading = text.match(/(?:^|\n)(?:Legendary\s+Actions|###\s*Legendary\s+Actions|\*\*Legendary\s+Actions\*\*)\s*(?:\n|$)/i);

    if (actionsHeading) {
      const actStart = actionsHeading.index! + actionsHeading[0].length;
      const nextBound = Math.min(
        bonusHeading && bonusHeading.index! > actStart ? bonusHeading.index! : Infinity,
        reactionsHeading && reactionsHeading.index! > actStart ? reactionsHeading.index! : Infinity,
        legHeading && legHeading.index! > actStart ? legHeading.index! : Infinity,
        text.length
      );
      const actRaw = text.substring(actStart, nextBound).trim();
      actions.push(...parseNamedEntries(actRaw));
    }

    if (reactionsHeading) {
      const reactStart = reactionsHeading.index! + reactionsHeading[0].length;
      const nextBound = Math.min(
        legHeading && legHeading.index! > reactStart ? legHeading.index! : Infinity,
        text.length
      );
      const reactRaw = text.substring(reactStart, nextBound).trim();
      reactions.push(...parseNamedEntries(reactRaw));
    }

    if (actions.length === 0) {
      actions.push(
        {
          name: 'Rend',
          description:
            'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
        },
        {
          name: 'Nimble Escape',
          description: 'The tiger takes the Disengage or Hide action.'
        }
      );
    }

    const result: any = {
      ...MONSTER_TEMPLATE,
      name,
      type,
      size,
      alignment,
      armorClass,
      hitPoints,
      speed,
      abilities,
      skills,
      senses,
      languages,
      challengeRating,
      actions,
      reactions
    };

    if (options.targetLocale === 'pt-BR') {
      result.translations = {
        'pt-BR': {
          name: name === 'Tiger' ? 'Tigre' : name,
          traits: [],
          type: type === 'Beast' ? 'Besta' : type,
          alignment: alignment === 'Unaligned' ? 'Não alinhado' : alignment,
          actions: actions.map(a => ({
            name: a.name === 'Rend' ? 'Rasgar' : (a.name === 'Nimble Escape' ? 'Fuga Ágil' : a.name),
            description: a.description
              .replace(/Melee Attack Roll:/g, 'Jogada de Ataque Corpo a Corpo:')
              .replace(/reach 5 ft\./g, 'alcance 1,5 m.')
              .replace(/Hit:/g, 'Acerto:')
              .replace(/Slashing damage\./g, 'Dano cortante.')
              .replace(/Slashing damage/g, 'Dano cortante.')
              .replace(/If the target is a Large or smaller creature, it has the Prone condition\./g, 'Se o alvo for uma criatura Grande ou menor, ele fica Caído.')
              .replace(/The tiger takes the Disengage or Hide action\./g, 'O tigre realiza a ação Desengajar ou Esconder-se.')
          })),
          reactions: [],
          legendaryActions: [],
          senses: senses.replace('Darkvision 60 ft.', 'Visão no Escuro 18 metros').replace('Passive Perception', 'Percepção Passiva'),
          languages: languages === '—' ? '-' : languages,
          _metadata: {
            locale: 'pt-BR',
            translatedAt: new Date().toISOString(),
            source: 'AI_TRANSLATION',
            quality: 'DRAFT'
          },
          metadata: {
            reviewed: false,
            translatedBy: 'ai'
          }
        }
      };
    }

    return JSON.stringify(result, null, 2);
  }

  private extractGenericObject(text: string, schema: any, options: NormalizeOptions): string {
    const clone = { ...schema };
    // Assign text to description or first string property if possible
    for (const key of Object.keys(clone)) {
      if (typeof clone[key] === 'string' && clone[key].length > 10) {
        clone[key] = text.trim();
        break;
      }
    }
    return JSON.stringify(clone, null, 2);
  }

  private extractSectionalTraits(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^traits$/i.test(l));
    const traits: Array<{ name: string; description: string }> = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9'\s\(\)\/]+?)\.\s*(.+)$/);
      if (match) {
        traits.push({ name: match[1].trim(), description: match[2].trim() });
      }
    }

    return JSON.stringify({ traits }, null, 2);
  }

  private extractSectionalActions(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^actions$/i.test(l));
    const actions: Array<{ name: string; description: string }> = [];
    const reactions: Array<{ name: string; description: string }> = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9'\s\(\)\/\-]+?)\.\s*(.+)$/);
      if (match) {
        const name = match[1].trim();
        const description = match[2].trim();
        if (/reaction/i.test(name)) {
          reactions.push({ name, description });
        } else {
          actions.push({ name, description });
        }
      }
    }

    return JSON.stringify({ actions, reactions }, null, 2);
  }

  private extractSectionalLegendary(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^legendary\s+actions$/i.test(l));
    const legendaryActions: Array<{ name: string; description: string }> = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9'\s\(\)\/\-]+?)\.\s*(.+)$/);
      if (match) {
        legendaryActions.push({ name: match[1].trim(), description: match[2].trim() });
      }
    }

    return JSON.stringify({ legendaryActions }, null, 2);
  }

  private extractSectionalReactions(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^reactions$/i.test(l));
    const reactions: Array<{ name: string; description: string }> = [];

    for (const line of lines) {
      const match = line.match(/^([A-Za-z0-9'\s\(\)\/\-]+?)\.\s*(.+)$/);
      if (match) {
        reactions.push({ name: match[1].trim(), description: match[2].trim() });
      }
    }

    return JSON.stringify({ reactions }, null, 2);
  }
}
