import { ObjectIdHelper } from './objectId';

export class ObjectFormatter {
  /**
   * Known integer field patterns in RPG / MongoDB documents that should be NumberInt in Mongo shell
   */
  private static isNumberIntField(key: string, value: any): boolean {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+$/.test(value))) {
      return false;
    }
    const intKeys = [
      'armorclass',
      'hitpoints',
      'proficiencybonus',
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
      'walk',
      'fly',
      'swim',
      'climb',
      'cost',
      'level'
    ];
    if (intKeys.includes(key.toLowerCase())) return true;
    if (key.toLowerCase() === 'challengerating' && Number.isInteger(Number(value))) {
      return true;
    }
    return false;
  }

  /**
   * Known ObjectId fields
   */
  private static isObjectIdField(key: string, value: any): boolean {
    if (!ObjectIdHelper.isValid(value)) return false;
    const oidKeys = ['_id', 'id', 'book', 'bookid', 'books', 'userid', 'createdby', 'updatedby'];
    if (oidKeys.includes(key.toLowerCase())) return true;
    return false;
  }

  /**
   * Known Date fields
   */
  private static isDateField(key: string, value: any): boolean {
    if (value instanceof Date) return true;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return true;
    }
    const dateKeys = ['createdat', 'updatedat', 'translatedat'];
    return dateKeys.includes(key.toLowerCase()) && !isNaN(Date.parse(String(value)));
  }

  /**
   * Formats a normalized object into MongoDB Shell syntax:
   * ObjectId('...'), NumberInt('...'), ISODate('...')
   */
  static toMongoShell(obj: any, indentLevel = 0): string {
    const indent = '  '.repeat(indentLevel);
    const childIndent = '  '.repeat(indentLevel + 1);

    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj.map(item => `${childIndent}${this.formatShellValue('', item, indentLevel + 1)}`);
      return `[\n${items.join(',\n')}\n${indent}]`;
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';

      const entries = keys.map(key => {
        const val = obj[key];
        const formattedVal = this.formatShellValue(key, val, indentLevel + 1);
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
        return `${childIndent}${safeKey}: ${formattedVal}`;
      });

      return `{\n${entries.join(',\n')}\n${indent}}`;
    }

    return this.formatShellValue('', obj, indentLevel);
  }

  private static formatShellValue(key: string, value: any, indentLevel: number): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    // Dates
    if (this.isDateField(key, value)) {
      const dateStr = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
      return `ISODate('${dateStr}')`;
    }

    // ObjectIds
    if (this.isObjectIdField(key, value) || (key === '' && ObjectIdHelper.isValid(value))) {
      return `ObjectId('${value}')`;
    }

    // NumberInt
    if (this.isNumberIntField(key, value)) {
      return `NumberInt('${parseInt(String(value), 10)}')`;
    }

    // Numbers
    if (typeof value === 'number') {
      return Number.isInteger(value) ? `NumberInt('${value}')` : String(value);
    }

    // Booleans
    if (typeof value === 'boolean') {
      return String(value);
    }

    // Strings
    if (typeof value === 'string') {
      return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    }

    // Nested Arrays / Objects
    if (typeof value === 'object') {
      return this.toMongoShell(value, indentLevel);
    }

    return String(value);
  }

  /**
   * Formats a normalized object into MongoDB Extended JSON v2 format
   */
  static toMongoExtended(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.toMongoExtended(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (this.isDateField(key, val)) {
          const dateStr = val instanceof Date ? val.toISOString() : new Date(val as any).toISOString();
          result[key] = { $date: dateStr };
        } else if (this.isObjectIdField(key, val) || (typeof val === 'string' && ObjectIdHelper.isValid(val) && key.endsWith('id'))) {
          result[key] = { $oid: val };
        } else if (this.isNumberIntField(key, val)) {
          result[key] = { $numberInt: String(parseInt(String(val), 10)) };
        } else if (typeof val === 'object') {
          result[key] = this.toMongoExtended(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    }

    return obj;
  }
}
