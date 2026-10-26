import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { ObjectNormalizer } from './normalizer';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GroqProvider } from './providers/groq';
import { OllamaProvider } from './providers/ollama';
import { OpenRouterProvider } from './providers/openrouter';
import { CohereProvider } from './providers/cohere';
import { PollinationsProvider } from './providers/pollinations';
import { OVHProvider } from './providers/ovh';
import { MockProvider } from './providers/mock';
import { CerebrasProvider } from './providers/cerebras';
import { SambaNovaProvider } from './providers/sambanova';
import { MistralProvider } from './providers/mistral';
import { GitHubModelsProvider } from './providers/github';
import { DeepSeekProvider } from './providers/deepseek';
import { HuggingFaceProvider } from './providers/huggingface';
import { listTemplates, getTemplate } from './templates';
import { PropertyValidator } from './pipeline/validator';
import { ObjectFormatter } from './pipeline/formatter';
import { TextSplitter } from './pipeline/splitter';
import { NormalizeOptions, BatchNormalizeResult } from './types';
import { getProviderStore, IProviderStore } from './database';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger';

// Ensure .env in object-normalizer directory is loaded regardless of execution CWD
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve interactive Web UI playground
app.use(express.static(path.join(__dirname, '../public')));

// Swagger UI Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'Object Normalizer - API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: { persistAuthorization: true }
}));
app.get('/swagger', (req: Request, res: Response) => res.redirect('/docs'));
app.get('/swagger.json', (req: Request, res: Response) => res.json(swaggerDocument));

/**
 * Initialize normalizer cascading providers
 */
function initializeNormalizer(): ObjectNormalizer {
  const normalizer = new ObjectNormalizer();

  // 0. Priority #1: Local Ollama (Qwen 2.5) - 100% Free, Private, Offline & Zero Rate Limits
  if (process.env.OLLAMA_ENABLED !== 'false') {
    normalizer.addProvider(new OllamaProvider(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      process.env.OLLAMA_API_KEY || 'ollama',
      'Local Ollama (Qwen 2.5)'
    ));
  }

  // 1. Ultra-fast and high-volume free tier providers (Cloud failover)
  if (process.env.GROQ_API_KEY) {
    normalizer.addProvider(new GroqProvider(process.env.GROQ_API_KEY));
  }
  if (process.env.CEREBRAS_API_KEY) {
    normalizer.addProvider(new CerebrasProvider(process.env.CEREBRAS_API_KEY));
  }
  if (process.env.SAMBANOVA_API_KEY) {
    normalizer.addProvider(new SambaNovaProvider(process.env.SAMBANOVA_API_KEY));
  }
  if (process.env.GEMINI_API_KEY) {
    normalizer.addProvider(new GeminiProvider(process.env.GEMINI_API_KEY));
  }
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    normalizer.addProvider(new GitHubModelsProvider(process.env.GITHUB_TOKEN || process.env.GH_TOKEN));
  }
  if (process.env.MISTRAL_API_KEY) {
    normalizer.addProvider(new MistralProvider(process.env.MISTRAL_API_KEY));
  }
  if (process.env.DEEPSEEK_API_KEY) {
    normalizer.addProvider(new DeepSeekProvider(process.env.DEEPSEEK_API_KEY));
  }
  if (process.env.OPENROUTER_API_KEY) {
    normalizer.addProvider(new OpenRouterProvider(process.env.OPENROUTER_API_KEY));
  }
  if (process.env.COHERE_API_KEY) {
    normalizer.addProvider(new CohereProvider(process.env.COHERE_API_KEY));
  }
  if (process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN) {
    normalizer.addProvider(new HuggingFaceProvider(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN));
  }
  if (process.env.OPENAI_API_KEY) {
    normalizer.addProvider(new OpenAIProvider(process.env.OPENAI_API_KEY));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    normalizer.addProvider(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  }

  // 2. Free Keyless AI Models (Zero signup, zero API keys required - active by default)
  normalizer.addProvider(new PollinationsProvider());
  normalizer.addProvider(new OVHProvider());

  // 3. Mock / Intelligent Heuristic Rule Extractor (Guarantees zero-failure fallback & offline testing)
  normalizer.addProvider(new MockProvider());

  return normalizer;
}

const normalizer = initializeNormalizer();
const store = getProviderStore();
normalizer.setStore(store);

// Asynchronously connect database and sync providers on startup
(async () => {
  try {
    await store.connect();
    await store.syncFromEnv();
    await normalizer.syncWithStore(store);
    const status = await store.getStatus();
    console.log(`📦 Provider Database Ready: [Engine: ${status.engine.toUpperCase()}] Connected: ${status.connected} | Tracked: ${status.providerCount} providers (${status.inCooldownCount} in cooldown, ${status.invalidCount} invalid)`);
  } catch (err: any) {
    console.warn(`[Server] Note: Provider database startup sync: ${err.message}`);
  }
})();

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'object-normalizer',
    providers: normalizer.getAvailableProviders(),
    timestamp: new Date().toISOString()
  });
});

// List available providers
app.get('/providers', (req: Request, res: Response) => {
  res.json({
    providers: normalizer.getAvailableProviders()
  });
});

// List all providers with availability status
app.get('/providers/all', (req: Request, res: Response) => {
  const all = normalizer.getAllProvidersInfo();
  res.json({
    providers: all,
    total: all.length,
    available: all.filter(p => p.available).length
  });
});

// Reset providers availability
app.post('/providers/reset', (req: Request, res: Response) => {
  normalizer.resetProviders();
  res.json({
    success: true,
    message: 'Providers reset successfully',
    providers: normalizer.getAvailableProviders()
  });
});

// Set provider cooldown manually or test cooldown mechanism
app.post('/providers/cooldown', (req: Request, res: Response) => {
  const { provider, seconds = 60, reason = 'Manual cooldown requested' } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'Property "provider" is required' });
  }
  normalizer.setProviderCooldown(provider, Number(seconds), reason);
  res.json({
    success: true,
    message: `Provider "${provider}" set offline for ${seconds} seconds`,
    providers: normalizer.getAllProvidersInfo()
  });
});

// ========================================================
// PERSISTENT DATABASE & PROVIDER MANAGEMENT ENDPOINTS
// ========================================================

// Get database engine status and counts
app.get('/database/status', async (req: Request, res: Response) => {
  try {
    const status = await store.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all providers tracked in database with computed status color and error details
app.get('/database/providers', async (req: Request, res: Response) => {
  try {
    const docs = await store.getAll();
    const now = Date.now();
    const showKeys = req.query.showKeys === 'true';
    const formatted = docs.map(doc => {
      const untilMs = doc.cooldownUntil ? new Date(doc.cooldownUntil).getTime() : 0;
      const inCooldown = untilMs > now;
      const cooldownRemainingSeconds = inCooldown ? Math.ceil((untilMs - now) / 1000) : 0;
      const isManuallyOff = doc.manuallyDisabled === true || doc.isAvailable === false;
      const isInvalid = doc.isValid === false;
      const isLongCooldown = inCooldown && cooldownRemainingSeconds > 86400;

      // Lightning status color logic:
      // - Red: Turned off, invalid key, or cooldown > 1 day (e.g. monthly quota)
      // - Yellow: Waiting in cooldown <= 1 day
      // - Green: Operational / okay
      let statusColor: 'green' | 'yellow' | 'red' = 'green';
      let statusLabel = 'Operational';

      if (isManuallyOff) {
        statusColor = 'red';
        statusLabel = 'Turned Off';
      } else if (isInvalid) {
        statusColor = 'red';
        statusLabel = 'Invalid Key / Auth Error';
      } else if (isLongCooldown) {
        statusColor = 'red';
        statusLabel = 'Monthly Quota (>1 Day)';
      } else if (inCooldown) {
        statusColor = 'yellow';
        statusLabel = 'Waiting (Cooldown)';
      }

      return {
        ...doc,
        apiKey: showKeys ? doc.apiKey : (doc.apiKey ? `${doc.apiKey.slice(0, 6)}...${doc.apiKey.slice(-4)}` : undefined),
        hasApiKey: Boolean(doc.apiKey && doc.apiKey.length > 0),
        inCooldown,
        cooldownRemainingSeconds,
        statusColor,
        statusLabel,
        isManuallyOff,
        lastErrorMessage: doc.lastErrorMessage || (isInvalid ? doc.validationError : undefined),
        lastErrorAt: doc.lastErrorAt || undefined
      };
    });
    res.json({
      success: true,
      total: formatted.length,
      providers: formatted
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single provider from database
app.get('/database/providers/:id', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await store.get(paramId);
    if (!doc) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }
    const showKeys = req.query.showKeys === 'true';
    const untilMs = doc.cooldownUntil ? new Date(doc.cooldownUntil).getTime() : 0;
    const inCooldown = untilMs > Date.now();
    const cooldownRemainingSeconds = inCooldown ? Math.ceil((untilMs - Date.now()) / 1000) : 0;

    res.json({
      success: true,
      provider: {
        ...doc,
        apiKey: showKeys ? doc.apiKey : (doc.apiKey ? `${doc.apiKey.slice(0, 6)}...${doc.apiKey.slice(-4)}` : undefined),
        hasApiKey: Boolean(doc.apiKey && doc.apiKey.length > 0),
        inCooldown,
        cooldownRemainingSeconds
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert provider (create or update keys, models, metadata)
app.post('/database/providers', async (req: Request, res: Response) => {
  try {
    const { id, name, apiKey, model, isValid, isAvailable, metadata } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Property "id" is required (e.g. "groq", "gemini", "github")' });
    }
    const updated = await store.upsert({
      id,
      name,
      apiKey,
      model,
      isValid,
      isAvailable,
      metadata
    });
    await normalizer.syncWithStore(store);
    res.json({
      success: true,
      provider: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set custom cooldown timestamp on a provider (supports seconds, days, until timestamp, or 'month')
app.post('/database/providers/:id/cooldown', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { seconds, days, until, reason = 'Manual cooldown requested', rateLimitType } = req.body;

    let targetUntil: Date;
    let targetSeconds = 0;
    let limitType = rateLimitType;

    if (until) {
      targetUntil = new Date(until);
      targetSeconds = Math.max(1, Math.ceil((targetUntil.getTime() - Date.now()) / 1000));
    } else if (days) {
      targetSeconds = Math.round(Number(days) * 86400);
      targetUntil = new Date(Date.now() + targetSeconds * 1000);
      if (!limitType) limitType = 'day';
    } else if (limitType === 'month') {
      const now = new Date();
      targetUntil = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 2, 0));
      targetSeconds = Math.max(1, Math.ceil((targetUntil.getTime() - Date.now()) / 1000));
    } else {
      targetSeconds = Number(seconds) || 60;
      targetUntil = new Date(Date.now() + targetSeconds * 1000);
    }

    const updated = await store.setCooldown(paramId, targetUntil, reason, limitType);
    if (!updated) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }

    // Also apply to normalizer in memory immediately
    normalizer.setProviderCooldown(updated.name || paramId, targetSeconds, reason, limitType);

    res.json({
      success: true,
      message: `Provider "${paramId}" set on cooldown until ${targetUntil.toISOString()}`,
      provider: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear cooldown and restore provider to active rotation
app.post('/database/providers/:id/reset', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await store.clearCooldown(paramId);
    if (!updated) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }

    // Clear in normalizer in memory immediately
    normalizer.clearCooldown(updated.name || paramId);

    res.json({
      success: true,
      message: `Cooldown cleared for provider "${paramId}"`,
      provider: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark provider as valid or invalid (e.g. revoked key, authentication issue)
app.post('/database/providers/:id/validity', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isValid, validationError } = req.body;
    if (typeof isValid !== 'boolean') {
      return res.status(400).json({ error: 'Property "isValid" (boolean) is required' });
    }

    const updated = await store.setValidity(paramId, isValid, validationError);
    if (!updated) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }

    await normalizer.syncWithStore(store);

    res.json({
      success: true,
      message: `Provider "${paramId}" validity set to ${isValid}`,
      provider: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tick provider on or off manually (persists and stays off)
app.post('/database/providers/:id/toggle', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Property "enabled" (boolean) is required' });
    }

    const updated = await store.setManualState(paramId, enabled);
    if (!updated) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }

    // Immediately toggle in normalizer memory
    normalizer.setProviderAvailability(updated.name || paramId, enabled);

    res.json({
      success: true,
      message: `Provider "${paramId}" ${enabled ? 'enabled' : 'disabled'} successfully`,
      provider: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test provider connection ping
app.post('/database/providers/:id/test', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await store.get(paramId);
    if (!doc) {
      return res.status(404).json({ error: `Provider "${paramId}" not found in database` });
    }

    const startTime = Date.now();
    const testSample = "Goblin\nSmall Humanoid, Neutral Evil\nArmor Class 15\nHit Points 7\nSpeed 30 ft.";
    const result = await normalizer.normalize(testSample, 'monster', {
      specificProvider: doc.name || paramId,
      allowMock: false,
      providerTimeoutMs: 15000
    });

    res.json({
      success: true,
      message: `Provider "${doc.name}" connection test succeeded in ${Date.now() - startTime}ms`,
      latencyMs: Date.now() - startTime,
      provider: result.provider,
      sampleExtracted: result.data?.name || 'Goblin'
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: err.message || 'Provider connection test failed'
    });
  }
});

// Delete a custom provider
app.delete('/database/providers/:id', async (req: Request, res: Response) => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (typeof (store as any).delete === 'function') {
      await (store as any).delete(paramId);
    }
    normalizer.removeProvider(paramId);
    res.json({
      success: true,
      message: `Provider "${paramId}" deleted successfully`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Re-sync database from .env file
app.post('/database/sync', async (req: Request, res: Response) => {
  try {
    const result = await store.syncFromEnv();
    await normalizer.syncWithStore(store);
    const status = await store.getStatus();

    res.json({
      success: true,
      message: 'Database synced with .env successfully',
      syncResult: result,
      databaseStatus: status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List predefined templates
app.get('/templates', (req: Request, res: Response) => {
  res.json({
    templates: listTemplates()
  });
});

// Get single template
app.get('/templates/:name', (req: Request, res: Response) => {
  const paramName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const template = getTemplate(paramName);
  if (!template) {
    return res.status(404).json({ error: `Template "${paramName}" not found` });
  }
  res.json(template);
});

// Helper for extracting clean string from headers
const getHeaderString = (val: string | string[] | undefined): string | undefined =>
  typeof val === 'string' ? val : (Array.isArray(val) ? val[0] : undefined);

// Normalize endpoint
app.post('/normalize', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { text, schema, template, options = {} } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Property "text" is required and must be a non-empty string'
      });
    }

    const requestedProvider =
      req.body.specificProvider ||
      req.body.provider ||
      options.specificProvider ||
      options.provider ||
      getHeaderString(req.headers['x-provider']) ||
      getHeaderString(req.headers['x-specific-provider']);

    const isMockRequested =
      requestedProvider === 'mock' ||
      requestedProvider === 'deterministic' ||
      req.body.allowMock === true ||
      options.allowMock === true ||
      req.body.useMock === true ||
      req.headers['x-allow-mock'] === 'true';

    // Merge options
    const mergedOptions: NormalizeOptions = {
      ...options,
      ...(template && { template }),
      ...(requestedProvider && { specificProvider: requestedProvider }),
      ...(isMockRequested && { allowMock: true }),
      ...(req.body.autoSplit !== undefined && { autoSplit: Boolean(req.body.autoSplit) }),
      ...(req.body.chunked !== undefined && { chunked: Boolean(req.body.chunked) }),
      ...(req.body.skipCache !== undefined && { skipCache: Boolean(req.body.skipCache) }),
      ...(req.body.cacheTtlMs !== undefined && { cacheTtlMs: Number(req.body.cacheTtlMs) }),
      ...(req.body.minIntervalMs !== undefined && { minIntervalMs: Number(req.body.minIntervalMs) }),
      ...(req.body.defaultCooldownSeconds !== undefined && { defaultCooldownSeconds: Number(req.body.defaultCooldownSeconds) }),
      ...(req.body.dailyCooldownSeconds !== undefined && { dailyCooldownSeconds: Number(req.body.dailyCooldownSeconds) }),
      ...(req.body.providerTimeoutMs !== undefined && { providerTimeoutMs: Number(req.body.providerTimeoutMs) }),
      ...(req.headers['x-min-interval-ms'] && { minIntervalMs: Number(req.headers['x-min-interval-ms']) }),
      ...(req.headers['x-cooldown-seconds'] && { defaultCooldownSeconds: Number(req.headers['x-cooldown-seconds']) }),
      ...(req.headers['x-daily-cooldown-seconds'] && { dailyCooldownSeconds: Number(req.headers['x-daily-cooldown-seconds']) }),
      ...(req.headers['x-provider-timeout-ms'] && { providerTimeoutMs: Number(req.headers['x-provider-timeout-ms']) }),
      ...(req.body.targetLocale && { targetLocale: req.body.targetLocale }),
      ...(getHeaderString(req.headers['x-target-locale']) && { targetLocale: getHeaderString(req.headers['x-target-locale']) }),
      ...(req.body.sourceLocale && { sourceLocale: req.body.sourceLocale }),
      ...(req.body.system && { system: req.body.system }),
      ...(req.body.edition && { edition: req.body.edition }),
      ...(req.query.system && { system: String(req.query.system) }),
      ...(req.query.edition && { edition: String(req.query.edition) }),
      ...(getHeaderString(req.headers['x-system']) && { system: getHeaderString(req.headers['x-system']) }),
      ...(getHeaderString(req.headers['x-edition']) && { edition: getHeaderString(req.headers['x-edition']) })
    };

    const reqGeminiKey = getHeaderString(req.headers['x-gemini-key']) || getHeaderString(req.headers['x-api-key']);
    const reqOpenAiKey = getHeaderString(req.headers['x-openai-key']);
    const reqGroqKey = getHeaderString(req.headers['x-groq-key']);
    const reqCerebrasKey = getHeaderString(req.headers['x-cerebras-key']);
    const reqSambaNovaKey = getHeaderString(req.headers['x-sambanova-key']);
    const reqMistralKey = getHeaderString(req.headers['x-mistral-key']);
    const reqGitHubKey = getHeaderString(req.headers['x-github-token']) || getHeaderString(req.headers['x-github-key']);
    const reqDeepSeekKey = getHeaderString(req.headers['x-deepseek-key']);

    let activeNormalizer = normalizer;
    if (reqGeminiKey || reqOpenAiKey || reqGroqKey || reqCerebrasKey || reqSambaNovaKey || reqMistralKey || reqGitHubKey || reqDeepSeekKey) {
      activeNormalizer = new ObjectNormalizer();
      if (process.env.OLLAMA_ENABLED !== 'false') {
        activeNormalizer.addProvider(new OllamaProvider(
          process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
          process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          process.env.OLLAMA_API_KEY || 'ollama',
          'Local Ollama (Qwen 2.5)'
        ));
      }
      if (reqGroqKey) activeNormalizer.addProvider(new GroqProvider(reqGroqKey));
      if (reqCerebrasKey) activeNormalizer.addProvider(new CerebrasProvider(reqCerebrasKey));
      if (reqSambaNovaKey) activeNormalizer.addProvider(new SambaNovaProvider(reqSambaNovaKey));
      if (reqGeminiKey) activeNormalizer.addProvider(new GeminiProvider(reqGeminiKey));
      if (reqGitHubKey) activeNormalizer.addProvider(new GitHubModelsProvider(reqGitHubKey));
      if (reqMistralKey) activeNormalizer.addProvider(new MistralProvider(reqMistralKey));
      if (reqDeepSeekKey) activeNormalizer.addProvider(new DeepSeekProvider(reqDeepSeekKey));
      if (reqOpenAiKey) activeNormalizer.addProvider(new OpenAIProvider(reqOpenAiKey));
      activeNormalizer.addProvider(new PollinationsProvider());
      activeNormalizer.addProvider(new OVHProvider());
      activeNormalizer.addProvider(new MockProvider());
    }

    console.log(`[${new Date().toISOString()}] POST /normalize`);
    console.log(`  → Text length: ${text.length} chars | Template: ${mergedOptions.template || 'custom'}${mergedOptions.autoSplit ? ' | AutoSplit: true' : ''}`);
    if (mergedOptions.specificProvider) {
      console.log(`  → Requested specific provider: ${mergedOptions.specificProvider}`);
    }

    // Auto-split multi-entity requests
    if (mergedOptions.autoSplit) {
      const splitResult = await activeNormalizer.normalizeAutoSplit(text, schema, mergedOptions);
      const duration = Date.now() - startTime;
      console.log(`  ✓ Auto-split normalized ${splitResult.count} entity/entities in ${duration}ms`);
      return res.json(splitResult);
    }

    const result = await activeNormalizer.normalize(text, schema, mergedOptions);
    const duration = Date.now() - startTime;

    console.log(`  ✓ Normalized via ${result.provider} in ${duration}ms (Checks: ${result.validation.checksRun}, Coerced: ${result.validation.coercedFields.length})`);

    res.json(result);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`  ✗ Normalization failed after ${duration}ms:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Normalization failed'
    });
  }
});

// Dedicated auto-split endpoint
app.post('/normalize/auto-split', async (req: Request, res: Response) => {
  req.body.autoSplit = true;
  // Delegate directly to /normalize with autoSplit = true
  return app._router.handle(req, res, () => {});
});

// Preprocess and preview text chunks without calling AI models
app.post('/preprocess', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Property "text" is required' });
  }

  const cleanedText = TextSplitter.stripNoisyArtifacts(text);
  const sections = TextSplitter.splitMonsters(text);

  res.json({
    cleanedText,
    count: sections.length,
    entities: sections.map(s => ({
      name: s.name,
      type: s.type,
      length: s.text.length,
      snippet: s.text.slice(0, 200) + (s.text.length > 200 ? '...' : '')
    }))
  });
});

// Batch normalize endpoint
app.post('/normalize/batch', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { items, defaults = {}, options = {} } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Property "items" must be a non-empty array of normalization requests'
      });
    }

    console.log(`[${new Date().toISOString()}] POST /normalize/batch - ${items.length} items`);

    const results = [];
    let successfulCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const requestedItemProvider =
          item.specificProvider ||
          item.provider ||
          item.options?.specificProvider ||
          item.options?.provider ||
          req.body.specificProvider ||
          req.body.provider ||
          options.specificProvider ||
          options.provider;

        const isMockItem =
          requestedItemProvider === 'mock' ||
          requestedItemProvider === 'deterministic' ||
          item.allowMock === true ||
          item.options?.allowMock === true ||
          req.body.allowMock === true ||
          options.allowMock === true;

        const itemSystem =
          item.system ||
          item.options?.system ||
          options.system ||
          req.body.system ||
          (req.query.system ? String(req.query.system) : undefined) ||
          getHeaderString(req.headers['x-system']);
        const itemEdition =
          item.edition ||
          item.options?.edition ||
          options.edition ||
          req.body.edition ||
          (req.query.edition ? String(req.query.edition) : undefined) ||
          getHeaderString(req.headers['x-edition']);

        const itemOptions: NormalizeOptions = {
          ...options,
          ...item.options,
          ...(requestedItemProvider && { specificProvider: requestedItemProvider }),
          ...(isMockItem && { allowMock: true }),
          ...(itemSystem && { system: itemSystem }),
          ...(itemEdition && { edition: itemEdition }),
          defaults: { ...defaults, ...(options.defaults || {}), ...(item.options?.defaults || {}) }
        };
        const result = await normalizer.normalize(item.text, item.schema, itemOptions);
        results.push({
          index: i,
          success: true,
          result
        });
        successfulCount++;
      } catch (err: any) {
        results.push({
          index: i,
          success: false,
          error: err.message || 'Item normalization failed'
        });
        failedCount++;
      }
    }

    const durationMs = Date.now() - startTime;
    const batchResponse: BatchNormalizeResult = {
      success: failedCount === 0,
      total: items.length,
      successful: successfulCount,
      failed: failedCount,
      durationMs,
      results
    };

    res.json(batchResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Batch normalization failed'
    });
  }
});

// Direct property validation & checks endpoint (no AI, validation only)
app.post('/validate', (req: Request, res: Response) => {
  try {
    const { data, schema, template, options = {} } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Property "data" is required and must be an object'
      });
    }

    let targetSchema = schema;
    if (template) {
      const tmpl = getTemplate(template);
      if (tmpl) targetSchema = tmpl.schema;
    }

    const mergedOptions: NormalizeOptions = {
      ...options,
      ...(req.body.system && { system: req.body.system }),
      ...(req.body.edition && { edition: req.body.edition }),
      ...(req.query.system && { system: String(req.query.system) }),
      ...(req.query.edition && { edition: String(req.query.edition) }),
      ...(getHeaderString(req.headers['x-system']) && { system: getHeaderString(req.headers['x-system']) }),
      ...(getHeaderString(req.headers['x-edition']) && { edition: getHeaderString(req.headers['x-edition']) }),
      ...(template && { template })
    };

    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      data,
      targetSchema,
      mergedOptions
    );

    const mongoShell = ObjectFormatter.toMongoShell(normalized);
    const mongoExtended = ObjectFormatter.toMongoExtended(normalized);

    res.json({
      success: true,
      data: normalized,
      mongoShell,
      mongoExtended,
      validation,
      relations
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Validation failed'
    });
  }
});

// -------------------------------------------------------------
// Multipart Session Endpoints (Staged ingestion for large entities)
// -------------------------------------------------------------

// Start a new multipart session
app.post('/normalize/multipart/start', (req: Request, res: Response) => {
  try {
    const { template = 'monster', options = {} } = req.body;
    const sessionId = normalizer.cache.createSession(template, options);
    res.json({
      success: true,
      sessionId,
      template,
      message: 'Multipart session created. Send sections (header, traits, actions, legendary) to /normalize/multipart/:sessionId/part'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit a single part into the session
app.post('/normalize/multipart/:sessionId/part', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const { section, text } = req.body;

    if (!section || !text) {
      return res.status(400).json({ success: false, error: 'Properties "section" and "text" are required' });
    }

    const result = await normalizer.normalizeSessionPart(sessionId, section, text);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete and stitch the session into a final entity
app.post('/normalize/multipart/:sessionId/complete', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const { options = {} } = req.body;

    const result = await normalizer.completeMultipartSession(sessionId, options);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check session status
app.get('/normalize/multipart/:sessionId', (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const session = normalizer.cache.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }
  res.json({
    success: true,
    sessionId: session.sessionId,
    template: session.template,
    partsCompleted: Object.keys(session.parts),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
});

// Cache metrics
app.get('/cache/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    cache: normalizer.cache.getStats()
  });
});

// Clear cache
app.post('/cache/clear', (req: Request, res: Response) => {
  normalizer.cache.clear();
  res.json({
    success: true,
    message: 'Cache and active sessions cleared successfully'
  });
});

const server = app.listen(PORT);

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
    console.error(`   To free port ${PORT} on Windows PowerShell, run:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    console.error(`\n❌ Server error:`, err);
    process.exit(1);
  }
});

server.on('listening', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Object Normalizer API running at http://localhost:${PORT}`);
  console.log(`📡 Available cascading providers: ${normalizer.getAvailableProviders().join(', ')}`);
  console.log(`🌐 Interactive Playground UI: http://localhost:${PORT}/`);
  console.log(`======================================================\n`);
  console.log(`Endpoints:`);
  console.log(`  POST /normalize        - Normalize raw paragraph into structured object`);
  console.log(`  POST /normalize/batch  - Batch normalize multiple paragraphs`);
  console.log(`  POST /validate         - Run schema property checks & formatting on JSON`);
  console.log(`  GET  /templates        - List predefined schemas`);
  console.log(`  GET  /templates/:name  - Retrieve template and example text`);
  console.log(`  GET  /providers        - List available providers`);
  console.log(`  GET  /database/status  - Provider database engine and tracking status`);
  console.log(`  GET  /database/providers - List all tracked AI providers & persistent cooldowns`);
  console.log(`  GET  /health           - Health check status\n`);
});

// Configure generous timeouts for large batch normalization runs
server.setTimeout(600000); // 10 minutes socket timeout
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown on process termination signals
const gracefulShutdown = () => {
  store.disconnect().catch(() => {});
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;
