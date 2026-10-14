/**
 * Text preprocessing and chunking utilities for noisy D&D text scrapes.
 */

export interface SplitSection {
  name: string;
  type?: string;
  text: string;
}

export class TextSplitter {
  /**
   * Cleans markdown hyperlinks, converting [Display Text](url) into Display Text
   */
  static cleanMarkdownLinks(text: string): string {
    if (!text) return '';
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  /**
   * Cleans standalone artist credits, quotes, and non-combat discovery tables
   */
  static stripNoisyArtifacts(text: string): string {
    if (!text) return '';

    let cleaned = this.cleanMarkdownLinks(text);

    // Remove speech bubbles and quote attributions (e.g. "—Author, Title")
    cleaned = cleaned.replace(/^[—–-]\s*[A-Z][a-zA-Z\s,]+$/gm, '');

    return cleaned;
  }

  /**
   * Detects and splits multiple monster stat blocks within a single pasted text block.
   * Matches patterns like:
   *   [Creature Name] or Creature Name
   *   Large Monstrosity, Unaligned
   *   AC 14
   */
  static splitMonsters(rawText: string): SplitSection[] {
    const cleaned = this.cleanMarkdownLinks(rawText);

    // Pattern for monster header: Name followed by (Size Type, Alignment)
    // Matches sizes: Tiny, Small, Medium, Large, Huge, Gargantuan
    const monsterHeaderRegex = /(?:^|\n)(?:\[([^\]]+)\]|([A-Z][A-Za-z0-9'\s\-]+))\n((?:Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(?:Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)[^\n]*)/gi;

    const matches: Array<{ name: string; fullType: string; startIndex: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = monsterHeaderRegex.exec(cleaned)) !== null) {
      const name = (match[1] || match[2]).trim();
      const fullType = match[3].trim();
      // Only treat as monster stat block if followed within next 200 chars by AC or Armor Class
      const lookahead = cleaned.slice(match.index, match.index + 300);
      if (/AC\s+\d+|Armor\s+Class\s+\d+/i.test(lookahead)) {
        matches.push({
          name,
          fullType,
          startIndex: match.index
        });
      }
    }

    if (matches.length <= 1) {
      // Single monster or unseparated text
      return [
        {
          name: matches[0]?.name || 'Unknown',
          type: matches[0]?.fullType,
          text: cleaned.trim()
        }
      ];
    }

    // Split into distinct chunks
    const sections: SplitSection[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const sectionText = next
        ? cleaned.slice(current.startIndex, next.startIndex)
        : cleaned.slice(current.startIndex);

      sections.push({
        name: current.name,
        type: current.fullType,
        text: sectionText.trim()
      });
    }

    return sections;
  }
}
