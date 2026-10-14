import crypto from 'crypto';

export interface MultipartSession {
  sessionId: string;
  template: string;
  options: Record<string, any>;
  parts: Record<string, any>;
  rawParts: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheStats {
  totalKeys: number;
  activeSessions: number;
  totalHits: number;
  totalMisses: number;
}

export class NormalizationCache {
  private static instance: NormalizationCache;
  private entries: Map<string, CacheEntry> = new Map();
  private sessions: Map<string, MultipartSession> = new Map();
  private hits = 0;
  private misses = 0;
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTtlMs: number = 24 * 60 * 60 * 1000) {
    // Clean up expired items every 15 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  static getInstance(): NormalizationCache {
    if (!NormalizationCache.instance) {
      NormalizationCache.instance = new NormalizationCache();
    }
    return NormalizationCache.instance;
  }

  /**
   * Generates a stable hash key for a request payload
   */
  static generateHashKey(text: string, template?: string, options: Record<string, any> = {}): string {
    const canonical = {
      text: text.trim().replace(/\r\n/g, '\n'),
      template: template || 'custom',
      locale: options.targetLocale || 'en',
      format: options.format || 'all'
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  /**
   * Get cached normalization result by hash key
   */
  get<T = any>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }

    entry.hits++;
    this.hits++;
    return entry.value as T;
  }

  /**
   * Set cached normalization result
   */
  set<T = any>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTtlMs;
    const now = Date.now();
    this.entries.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      hits: 0
    });
  }

  /**
   * Create a new multipart session for stitching large entities
   */
  createSession(template = 'monster', options: Record<string, any> = {}): string {
    const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
    const now = Date.now();
    this.sessions.set(sessionId, {
      sessionId,
      template,
      options,
      parts: {},
      rawParts: {},
      createdAt: now,
      updatedAt: now
    });
    return sessionId;
  }

  /**
   * Retrieve a multipart session
   */
  getSession(sessionId: string): MultipartSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Store a normalized part in a session
   */
  saveSessionPart(sessionId: string, sectionName: string, normalizedPart: any, rawPartText?: string): MultipartSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found or has expired`);
    }

    session.parts[sectionName] = normalizedPart;
    if (rawPartText) {
      session.rawParts[sectionName] = rawPartText;
    }
    session.updatedAt = Date.now();
    return session;
  }

  /**
   * Remove a completed or cancelled session
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Purge expired cache entries and old sessions (> 2 hours old)
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
      }
    }

    // Sessions expire after 2 hours of inactivity
    const sessionTimeout = 2 * 60 * 60 * 1000;
    for (const [id, sess] of this.sessions.entries()) {
      if (now - sess.updatedAt > sessionTimeout) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Return cache metrics
   */
  getStats(): CacheStats {
    return {
      totalKeys: this.entries.size,
      activeSessions: this.sessions.size,
      totalHits: this.hits,
      totalMisses: this.misses
    };
  }

  /**
   * Reset cache
   */
  clear(): void {
    this.entries.clear();
    this.sessions.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
