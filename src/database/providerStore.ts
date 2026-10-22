import fs from 'fs';
import path from 'path';
import { MongoClient, Db, Collection } from 'mongodb';
import { ProviderDocument, DatabaseStatus, RateLimitType } from './types';

export interface IProviderStore {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getAll(): Promise<ProviderDocument[]>;
  get(id: string): Promise<ProviderDocument | null>;
  upsert(doc: Partial<ProviderDocument> & { id: string }): Promise<ProviderDocument>;
  delete?(id: string): Promise<boolean>;
  setCooldown(
    id: string,
    until: Date | string,
    reason: string,
    rateLimitType?: RateLimitType
  ): Promise<ProviderDocument | null>;
  clearCooldown(id: string): Promise<ProviderDocument | null>;
  setValidity(id: string, isValid: boolean, validationError?: string): Promise<ProviderDocument | null>;
  setManualState(id: string, isEnabled: boolean): Promise<ProviderDocument | null>;
  recordError(id: string, errorMessage: string): Promise<ProviderDocument | null>;
  syncFromEnv(): Promise<{ synced: number; added: number; updated: number }>;
  getStatus(): Promise<DatabaseStatus>;
  getEngineType(): 'mongodb' | 'file' | 'disabled';
}

/**
 * Known default provider definitions to sync with .env
 */
export const KNOWN_PROVIDERS: Array<{
  id: string;
  name: string;
  providerType: string;
  envKey: string;
  envModelKey?: string;
  defaultModel?: string;
}> = [
  { id: 'groq', name: 'Groq', providerType: 'groq', envKey: 'GROQ_API_KEY', envModelKey: 'GROQ_MODEL', defaultModel: 'openai/gpt-oss-120b' },
  { id: 'cerebras', name: 'Cerebras', providerType: 'cerebras', envKey: 'CEREBRAS_API_KEY', envModelKey: 'CEREBRAS_MODEL', defaultModel: 'llama-3.3-70b' },
  { id: 'sambanova', name: 'SambaNova', providerType: 'sambanova', envKey: 'SAMBANOVA_API_KEY', envModelKey: 'SAMBANOVA_MODEL', defaultModel: 'Meta-Llama-3.3-70B-Instruct' },
  { id: 'gemini', name: 'Gemini', providerType: 'gemini', envKey: 'GEMINI_API_KEY', envModelKey: 'GEMINI_MODEL', defaultModel: 'gemini-3.8-flash' },
  { id: 'github', name: 'GitHub Models', providerType: 'github', envKey: 'GITHUB_TOKEN', envModelKey: 'GITHUB_MODELS_MODEL', defaultModel: 'gpt-4o-mini' },
  { id: 'mistral', name: 'Mistral AI', providerType: 'mistral', envKey: 'MISTRAL_API_KEY', envModelKey: 'MISTRAL_MODEL', defaultModel: 'mistral-small-latest' },
  { id: 'deepseek', name: 'DeepSeek', providerType: 'deepseek', envKey: 'DEEPSEEK_API_KEY', envModelKey: 'DEEPSEEK_MODEL', defaultModel: 'deepseek-chat' },
  { id: 'openrouter', name: 'OpenRouter', providerType: 'openrouter', envKey: 'OPENROUTER_API_KEY', envModelKey: 'OPENROUTER_MODEL', defaultModel: 'nvidia/nemotron-3.5-lightning:free' },
  { id: 'cohere', name: 'Cohere', providerType: 'cohere', envKey: 'COHERE_API_KEY', envModelKey: 'COHERE_MODEL', defaultModel: 'command-r-08-2024' },
  { id: 'huggingface', name: 'Hugging Face (Serverless)', providerType: 'huggingface', envKey: 'HUGGINGFACE_API_KEY', envModelKey: 'HUGGINGFACE_MODEL', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct' },
  { id: 'openai', name: 'OpenAI', providerType: 'openai', envKey: 'OPENAI_API_KEY', envModelKey: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic', providerType: 'anthropic', envKey: 'ANTHROPIC_API_KEY', envModelKey: 'ANTHROPIC_MODEL', defaultModel: 'claude-3-5-haiku-20241022' },
  { id: 'pollinations', name: 'Pollinations (Free AI)', providerType: 'pollinations', envKey: 'POLLINATIONS_MODEL', envModelKey: 'POLLINATIONS_MODEL', defaultModel: 'openai' },
  { id: 'ovh', name: 'Free Llama 3.3 70B (OVH)', providerType: 'ovh', envKey: 'OVH_ENABLED', defaultModel: 'llama-3.3-70b-instruct' }
];

/**
 * Local JSON file-based database (Zero external server required)
 */
export class FileProviderStore implements IProviderStore {
  private filePath: string;
  private cache: Map<string, ProviderDocument> = new Map();
  private connected = false;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(__dirname, '../../data/providers-db.json');
  }

  getEngineType(): 'mongodb' | 'file' | 'disabled' {
    return 'file';
  }

  async connect(): Promise<boolean> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed: ProviderDocument[] = JSON.parse(raw);
        this.cache.clear();
        for (const item of parsed) {
          this.cache.set(item.id, item);
        }
      } else {
        this.saveToFile();
      }

      this.connected = true;
      return true;
    } catch (err: any) {
      console.warn(`[FileProviderStore] Failed to load ${this.filePath}:`, err.message);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.saveToFile();
    this.connected = false;
  }

  private saveToFile(): void {
    try {
      const items = Array.from(this.cache.values());
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(items, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err: any) {
      console.error(`[FileProviderStore] Error saving to ${this.filePath}:`, err.message);
    }
  }

  async getAll(): Promise<ProviderDocument[]> {
    return Array.from(this.cache.values());
  }

  async get(id: string): Promise<ProviderDocument | null> {
    return this.cache.get(id.toLowerCase()) || null;
  }

  async upsert(doc: Partial<ProviderDocument> & { id: string }): Promise<ProviderDocument> {
    const id = doc.id.toLowerCase();
    const existing = this.cache.get(id);
    const now = new Date().toISOString();

    const merged: ProviderDocument = {
      id,
      name: doc.name || existing?.name || id,
      providerType: doc.providerType || existing?.providerType || id,
      apiKey: doc.apiKey !== undefined ? doc.apiKey : existing?.apiKey,
      baseUrl: doc.baseUrl !== undefined ? doc.baseUrl : existing?.baseUrl,
      model: doc.model !== undefined ? doc.model : existing?.model,
      isValid: doc.isValid !== undefined ? doc.isValid : (existing?.isValid ?? true),
      validationError: doc.validationError !== undefined ? doc.validationError : existing?.validationError,
      manuallyDisabled: doc.manuallyDisabled !== undefined ? doc.manuallyDisabled : (existing?.manuallyDisabled ?? false),
      lastErrorMessage: doc.lastErrorMessage !== undefined ? doc.lastErrorMessage : existing?.lastErrorMessage,
      lastErrorAt: doc.lastErrorAt !== undefined ? doc.lastErrorAt : existing?.lastErrorAt,
      isAvailable: doc.isAvailable !== undefined ? doc.isAvailable : (existing?.isAvailable ?? true),
      cooldownUntil: doc.cooldownUntil !== undefined ? doc.cooldownUntil : existing?.cooldownUntil,
      cooldownDurationSeconds: doc.cooldownDurationSeconds !== undefined ? doc.cooldownDurationSeconds : existing?.cooldownDurationSeconds,
      cooldownReason: doc.cooldownReason !== undefined ? doc.cooldownReason : existing?.cooldownReason,
      rateLimitType: doc.rateLimitType !== undefined ? doc.rateLimitType : existing?.rateLimitType,
      monthlyQuota: doc.monthlyQuota !== undefined ? doc.monthlyQuota : existing?.monthlyQuota,
      monthlyUsed: doc.monthlyUsed !== undefined ? doc.monthlyUsed : existing?.monthlyUsed,
      lastUsedAt: doc.lastUsedAt !== undefined ? doc.lastUsedAt : existing?.lastUsedAt,
      lastCheckedAt: doc.lastCheckedAt !== undefined ? doc.lastCheckedAt : existing?.lastCheckedAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      metadata: { ...(existing?.metadata || {}), ...(doc.metadata || {}) }
    };

    this.cache.set(id, merged);
    this.saveToFile();
    return merged;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.cache.delete(id.toLowerCase());
    if (deleted) this.saveToFile();
    return deleted;
  }

  async setCooldown(
    id: string,
    until: Date | string,
    reason: string,
    rateLimitType?: RateLimitType
  ): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const untilIso = typeof until === 'string' ? until : until.toISOString();
    const durationSeconds = Math.max(1, Math.ceil((new Date(untilIso).getTime() - Date.now()) / 1000));

    return this.upsert({
      id: existing.id,
      cooldownUntil: untilIso,
      cooldownDurationSeconds: durationSeconds,
      cooldownReason: reason,
      rateLimitType: rateLimitType || existing.rateLimitType || 'manual'
    });
  }

  async clearCooldown(id: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      cooldownUntil: null,
      cooldownDurationSeconds: 0,
      cooldownReason: undefined,
      rateLimitType: null
    });
  }

  async setValidity(id: string, isValid: boolean, validationError?: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      isValid,
      validationError: isValid ? undefined : validationError
    });
  }

  async setManualState(id: string, isEnabled: boolean): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      manuallyDisabled: !isEnabled,
      isAvailable: isEnabled
    });
  }

  async recordError(id: string, errorMessage: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      lastErrorMessage: errorMessage,
      lastErrorAt: new Date().toISOString()
    });
  }

  async syncFromEnv(): Promise<{ synced: number; added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const p of KNOWN_PROVIDERS) {
      const isKeyless = p.id === 'pollinations' || p.id === 'ovh';
      const rawKey = process.env[p.envKey];
      const model = p.envModelKey ? process.env[p.envModelKey] || p.defaultModel : p.defaultModel;

      const hasKey = isKeyless || (rawKey && rawKey.trim().length > 0);
      if (!hasKey) continue;

      const existing = this.cache.get(p.id);
      const isManuallyDisabled = existing?.manuallyDisabled === true;
      if (!existing) {
        await this.upsert({
          id: p.id,
          name: p.name,
          providerType: p.providerType,
          apiKey: rawKey || undefined,
          model,
          isValid: true,
          isAvailable: true,
          manuallyDisabled: false
        });
        added++;
      } else {
        // Update key and model if changed in .env, while preserving manual off toggle, cooldown and validity
        const keyChanged = rawKey && existing.apiKey !== rawKey;
        const modelChanged = model && existing.model !== model;
        if (keyChanged || modelChanged) {
          await this.upsert({
            id: p.id,
            apiKey: rawKey || existing.apiKey,
            model: model || existing.model,
            isAvailable: isManuallyDisabled ? false : existing.isAvailable
          });
          updated++;
        }
      }
    }

    return { synced: this.cache.size, added, updated };
  }

  async getStatus(): Promise<DatabaseStatus> {
    const all = Array.from(this.cache.values());
    const now = Date.now();
    return {
      enabled: true,
      engine: 'file',
      connected: this.connected,
      filePath: this.filePath,
      providerCount: all.length,
      availableCount: all.filter(p => p.isAvailable && p.isValid).length,
      inCooldownCount: all.filter(p => p.cooldownUntil && new Date(p.cooldownUntil).getTime() > now).length,
      invalidCount: all.filter(p => !p.isValid).length
    };
  }
}

/**
 * MongoDB-backed Provider Store
 */
export class MongoProviderStore implements IProviderStore {
  private uri: string;
  private dbName: string;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<ProviderDocument> | null = null;
  private connected = false;

  constructor(uri?: string, dbName: string = 'object-normalizer') {
    this.uri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
    this.dbName = dbName;
  }

  getEngineType(): 'mongodb' | 'file' | 'disabled' {
    return 'mongodb';
  }

  async connect(): Promise<boolean> {
    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 2500,
        connectTimeoutMS: 2500
      });
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection<ProviderDocument>('providers');

      // Create index on id
      await this.collection.createIndex({ id: 1 }, { unique: true });

      this.connected = true;
      console.log(`[MongoProviderStore] Connected successfully to MongoDB at ${this.uri} (db: ${this.dbName})`);
      return true;
    } catch (err: any) {
      console.warn(`[MongoProviderStore] MongoDB connection failed: ${err.message}`);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
      this.connected = false;
    }
  }

  async getAll(): Promise<ProviderDocument[]> {
    if (!this.collection) return [];
    return this.collection.find({}).toArray();
  }

  async get(id: string): Promise<ProviderDocument | null> {
    if (!this.collection) return null;
    return this.collection.findOne({ id: id.toLowerCase() });
  }

  async upsert(doc: Partial<ProviderDocument> & { id: string }): Promise<ProviderDocument> {
    if (!this.collection) throw new Error('MongoDB collection not initialized');

    const id = doc.id.toLowerCase();
    const existing = await this.get(id);
    const now = new Date().toISOString();

    const merged: ProviderDocument = {
      id,
      name: doc.name || existing?.name || id,
      providerType: doc.providerType || existing?.providerType || id,
      apiKey: doc.apiKey !== undefined ? doc.apiKey : existing?.apiKey,
      baseUrl: doc.baseUrl !== undefined ? doc.baseUrl : existing?.baseUrl,
      model: doc.model !== undefined ? doc.model : existing?.model,
      isValid: doc.isValid !== undefined ? doc.isValid : (existing?.isValid ?? true),
      validationError: doc.validationError !== undefined ? doc.validationError : existing?.validationError,
      manuallyDisabled: doc.manuallyDisabled !== undefined ? doc.manuallyDisabled : (existing?.manuallyDisabled ?? false),
      lastErrorMessage: doc.lastErrorMessage !== undefined ? doc.lastErrorMessage : existing?.lastErrorMessage,
      lastErrorAt: doc.lastErrorAt !== undefined ? doc.lastErrorAt : existing?.lastErrorAt,
      isAvailable: doc.isAvailable !== undefined ? doc.isAvailable : (existing?.isAvailable ?? true),
      cooldownUntil: doc.cooldownUntil !== undefined ? doc.cooldownUntil : existing?.cooldownUntil,
      cooldownDurationSeconds: doc.cooldownDurationSeconds !== undefined ? doc.cooldownDurationSeconds : existing?.cooldownDurationSeconds,
      cooldownReason: doc.cooldownReason !== undefined ? doc.cooldownReason : existing?.cooldownReason,
      rateLimitType: doc.rateLimitType !== undefined ? doc.rateLimitType : existing?.rateLimitType,
      monthlyQuota: doc.monthlyQuota !== undefined ? doc.monthlyQuota : existing?.monthlyQuota,
      monthlyUsed: doc.monthlyUsed !== undefined ? doc.monthlyUsed : existing?.monthlyUsed,
      lastUsedAt: doc.lastUsedAt !== undefined ? doc.lastUsedAt : existing?.lastUsedAt,
      lastCheckedAt: doc.lastCheckedAt !== undefined ? doc.lastCheckedAt : existing?.lastCheckedAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      metadata: { ...(existing?.metadata || {}), ...(doc.metadata || {}) }
    };

    await this.collection.updateOne(
      { id },
      { $set: merged },
      { upsert: true }
    );

    return merged;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.collection) return false;
    const res = await this.collection.deleteOne({ id: id.toLowerCase() });
    return res.deletedCount > 0;
  }

  async setCooldown(
    id: string,
    until: Date | string,
    reason: string,
    rateLimitType?: RateLimitType
  ): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const untilIso = typeof until === 'string' ? until : until.toISOString();
    const durationSeconds = Math.max(1, Math.ceil((new Date(untilIso).getTime() - Date.now()) / 1000));

    return this.upsert({
      id: existing.id,
      cooldownUntil: untilIso,
      cooldownDurationSeconds: durationSeconds,
      cooldownReason: reason,
      rateLimitType: rateLimitType || existing.rateLimitType || 'manual'
    });
  }

  async clearCooldown(id: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      cooldownUntil: null,
      cooldownDurationSeconds: 0,
      cooldownReason: undefined,
      rateLimitType: null
    });
  }

  async setValidity(id: string, isValid: boolean, validationError?: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      isValid,
      validationError: isValid ? undefined : validationError
    });
  }

  async setManualState(id: string, isEnabled: boolean): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      manuallyDisabled: !isEnabled,
      isAvailable: isEnabled
    });
  }

  async recordError(id: string, errorMessage: string): Promise<ProviderDocument | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.upsert({
      id: existing.id,
      lastErrorMessage: errorMessage,
      lastErrorAt: new Date().toISOString()
    });
  }

  async syncFromEnv(): Promise<{ synced: number; added: number; updated: number }> {
    let added = 0;
    let updated = 0;

    for (const p of KNOWN_PROVIDERS) {
      const isKeyless = p.id === 'pollinations' || p.id === 'ovh';
      const rawKey = process.env[p.envKey];
      const model = p.envModelKey ? process.env[p.envModelKey] || p.defaultModel : p.defaultModel;

      const hasKey = isKeyless || (rawKey && rawKey.trim().length > 0);
      if (!hasKey) continue;

      const existing = await this.get(p.id);
      const isManuallyDisabled = existing?.manuallyDisabled === true;
      if (!existing) {
        await this.upsert({
          id: p.id,
          name: p.name,
          providerType: p.providerType,
          apiKey: rawKey || undefined,
          model,
          isValid: true,
          isAvailable: true,
          manuallyDisabled: false
        });
        added++;
      } else {
        const keyChanged = rawKey && existing.apiKey !== rawKey;
        const modelChanged = model && existing.model !== model;
        if (keyChanged || modelChanged) {
          await this.upsert({
            id: p.id,
            apiKey: rawKey || existing.apiKey,
            model: model || existing.model,
            isAvailable: isManuallyDisabled ? false : existing.isAvailable
          });
          updated++;
        }
      }
    }

    const all = await this.getAll();
    return { synced: all.length, added, updated };
  }

  async getStatus(): Promise<DatabaseStatus> {
    const all = await this.getAll();
    const now = Date.now();
    return {
      enabled: true,
      engine: 'mongodb',
      connected: this.connected,
      uri: this.uri,
      providerCount: all.length,
      availableCount: all.filter(p => p.isAvailable && p.isValid).length,
      inCooldownCount: all.filter(p => p.cooldownUntil && new Date(p.cooldownUntil).getTime() > now).length,
      invalidCount: all.filter(p => !p.isValid).length
    };
  }
}

/**
 * Hybrid Store: Tries MongoDB first; if unavailable, seamlessly falls back to FileProviderStore
 */
export class HybridProviderStore implements IProviderStore {
  private activeStore: IProviderStore;
  private mongoStore: MongoProviderStore;
  private fileStore: FileProviderStore;

  constructor() {
    this.mongoStore = new MongoProviderStore();
    this.fileStore = new FileProviderStore();
    this.activeStore = this.fileStore; // Default to safe file store until mongo connects
  }

  getEngineType(): 'mongodb' | 'file' | 'disabled' {
    return this.activeStore.getEngineType();
  }

  async connect(): Promise<boolean> {
    const disabled = process.env.DATABASE_ENABLED === 'false';
    if (disabled) {
      console.log('[ProviderStore] Database persistence explicitly disabled via DATABASE_ENABLED=false');
      return false;
    }

    console.log('[ProviderStore] Attempting connection to MongoDB...');
    const mongoSuccess = await this.mongoStore.connect();

    if (mongoSuccess) {
      this.activeStore = this.mongoStore;
      console.log('[ProviderStore] 🍃 Active database engine: MongoDB');
      return true;
    }

    console.log('[ProviderStore] 📂 MongoDB offline or unreachable. Falling back to local JSON database...');
    await this.fileStore.connect();
    this.activeStore = this.fileStore;
    console.log('[ProviderStore] 📂 Active database engine: Local JSON File (./data/providers-db.json)');
    return true;
  }

  async disconnect(): Promise<void> {
    await this.activeStore.disconnect();
  }

  async getAll(): Promise<ProviderDocument[]> {
    return this.activeStore.getAll();
  }

  async get(id: string): Promise<ProviderDocument | null> {
    return this.activeStore.get(id);
  }

  async upsert(doc: Partial<ProviderDocument> & { id: string }): Promise<ProviderDocument> {
    return this.activeStore.upsert(doc);
  }

  async setCooldown(
    id: string,
    until: Date | string,
    reason: string,
    rateLimitType?: RateLimitType
  ): Promise<ProviderDocument | null> {
    return this.activeStore.setCooldown(id, until, reason, rateLimitType);
  }

  async clearCooldown(id: string): Promise<ProviderDocument | null> {
    return this.activeStore.clearCooldown(id);
  }

  async setValidity(id: string, isValid: boolean, validationError?: string): Promise<ProviderDocument | null> {
    return this.activeStore.setValidity(id, isValid, validationError);
  }

  async setManualState(id: string, isEnabled: boolean): Promise<ProviderDocument | null> {
    return this.activeStore.setManualState(id, isEnabled);
  }

  async recordError(id: string, errorMessage: string): Promise<ProviderDocument | null> {
    return this.activeStore.recordError(id, errorMessage);
  }

  async delete(id: string): Promise<boolean> {
    if (typeof (this.activeStore as any).delete === 'function') {
      return (this.activeStore as any).delete(id);
    }
    return false;
  }

  async syncFromEnv(): Promise<{ synced: number; added: number; updated: number }> {
    return this.activeStore.syncFromEnv();
  }

  async getStatus(): Promise<DatabaseStatus> {
    return this.activeStore.getStatus();
  }
}

// Global store singleton
let globalStore: HybridProviderStore | null = null;

export function getProviderStore(): HybridProviderStore {
  if (!globalStore) {
    globalStore = new HybridProviderStore();
  }
  return globalStore;
}
