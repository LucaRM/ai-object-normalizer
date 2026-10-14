import * as crypto from 'crypto';

/**
 * Lightweight MongoDB ObjectId generator and helper.
 * Compatible with official MongoDB 24-hex string representation without heavy dependencies.
 */
export class ObjectIdHelper {
  private static index = Math.floor(Math.random() * 0xffffff);

  /**
   * Generates a valid 24-character hexadecimal MongoDB ObjectId string
   */
  static generate(): string {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const machineAndProcess = crypto.randomBytes(5).toString('hex');
    this.index = (this.index + 1) % 0xffffff;
    const counter = this.index.toString(16).padStart(6, '0');
    return `${timestamp}${machineAndProcess}${counter}`.toLowerCase();
  }

  /**
   * Checks if a string is a valid 24-hex character ObjectId
   */
  static isValid(id: any): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Formats an ObjectId into Mongo Shell syntax: ObjectId('...')
   */
  static toShell(id: string): string {
    return `ObjectId('${id}')`;
  }
}
