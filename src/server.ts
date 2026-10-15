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
import { PollinationsProvider } from './providers/pollinations';
import { OVHProvider } from './providers/ovh';
import { MockProvider } from './providers/mock';
import { listTemplates, getTemplate } from './templates';
import { PropertyValidator } from './pipeline/validator';
import { ObjectFormatter } from './pipeline/formatter';
import { TextSplitter } from './pipeline/splitter';
import { NormalizeOptions, BatchNormalizeResult } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve interactive Web UI playground
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Initialize normalizer cascading providers
 */
function initializeNormalizer(): ObjectNormalizer {
  const normalizer = new ObjectNormalizer();

  // 1. Free Keyless AI Models (Zero signup, zero API keys required - active by default, like automatic-translator)
  normalizer.addProvider(new PollinationsProvider());
  normalizer.addProvider(new OVHProvider());

  // 2. Cloud AI Model Providers (Active when API keys are configured in .env)
  if (process.env.GEMINI_API_KEY) {
    normalizer.addProvider(new GeminiProvider(process.env.GEMINI_API_KEY));
  }
  if (process.env.GROQ_API_KEY) {
    normalizer.addProvider(new GroqProvider(process.env.GROQ_API_KEY));
  }
  if (process.env.OPENAI_API_KEY) {
    normalizer.addProvider(new OpenAIProvider(process.env.OPENAI_API_KEY));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    normalizer.addProvider(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  }
  if (process.env.OPENROUTER_API_KEY) {
    normalizer.addProvider(new OpenRouterProvider(process.env.OPENROUTER_API_KEY));
  }
  if (process.env.OLLAMA_ENABLED === 'true') {
    normalizer.addProvider(new OllamaProvider());
  }

  // 3. Mock / Intelligent Heuristic Rule Extractor (Guarantees zero-failure fallback & offline testing)
  normalizer.addProvider(new MockProvider());

  return normalizer;
}

const normalizer = initializeNormalizer();

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

    // Header overrides for custom API keys if provided per-request
    const getHeaderString = (val: string | string[] | undefined): string | undefined =>
      typeof val === 'string' ? val : (Array.isArray(val) ? val[0] : undefined);

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
      ...(req.headers['x-min-interval-ms'] && { minIntervalMs: Number(req.headers['x-min-interval-ms']) }),
      ...(req.headers['x-cooldown-seconds'] && { defaultCooldownSeconds: Number(req.headers['x-cooldown-seconds']) }),
      ...(req.body.targetLocale && { targetLocale: req.body.targetLocale }),
      ...(getHeaderString(req.headers['x-target-locale']) && { targetLocale: getHeaderString(req.headers['x-target-locale']) }),
      ...(req.body.sourceLocale && { sourceLocale: req.body.sourceLocale })
    };

    const reqGeminiKey = getHeaderString(req.headers['x-gemini-key']) || getHeaderString(req.headers['x-api-key']);
    const reqOpenAiKey = getHeaderString(req.headers['x-openai-key']);
    const reqGroqKey = getHeaderString(req.headers['x-groq-key']);

    let activeNormalizer = normalizer;
    if (reqGeminiKey || reqOpenAiKey || reqGroqKey) {
      activeNormalizer = new ObjectNormalizer();
      if (reqGeminiKey) activeNormalizer.addProvider(new GeminiProvider(reqGeminiKey));
      if (reqGroqKey) activeNormalizer.addProvider(new GroqProvider(reqGroqKey));
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

        const itemOptions: NormalizeOptions = {
          ...options,
          ...item.options,
          ...(requestedItemProvider && { specificProvider: requestedItemProvider }),
          ...(isMockItem && { allowMock: true }),
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

    const { normalized, validation, relations } = PropertyValidator.normalizeAndValidate(
      data,
      targetSchema,
      options
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

app.listen(PORT, () => {
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
  console.log(`  GET  /health           - Health check status\n`);
});

export default app;
