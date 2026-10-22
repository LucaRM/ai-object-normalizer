export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Object Normalizer API',
    version: '1.0.0',
    description: `### AI-Powered Cascading Schema Extraction & Object Normalization
A high-throughput, multi-provider AI normalization microservice for structured gaming, tabletop RPG, and custom JSON entity extraction.

#### Key Features:
- **Resilient Cascading Failover**: Groq → SambaNova → Cerebras → Gemini → GitHub Models → Mistral → DeepSeek → OpenRouter → Cohere → Hugging Face → Keyless AI (Pollinations, OVH) → Rule Extractor.
- **Persistent Provider Database**: Tracks all provider API keys, models, validity flags, and cooldown timestamps across server restarts.
- **Smart Cooldowns**: Automatically parses minute, daily, and monthly rate limits (e.g. waits until 1st of next month UTC for monthly quotas).
- **Embedded Translation & Auto-Split**: Normalizes multiple monsters in a single raw paste and translates descriptive text into pt-BR, es, fr, etc.`
  },
  servers: [
    {
      url: 'http://localhost:3009',
      description: 'Local Object Normalizer Server'
    }
  ],
  tags: [
    { name: 'Normalization', description: 'Core AI extraction and entity normalization endpoints' },
    { name: 'Validation', description: 'Property validation and schema checks without calling AI' },
    { name: 'Templates', description: 'Predefined entity schemas (Monsters, Items, Spells, Classes, Feats)' },
    { name: 'Providers & Database', description: 'AI provider management, live status, cooldowns, and on/off controls' },
    { name: 'Cache & Diagnostics', description: 'Cache statistics, health checks, and system diagnostics' }
  ],
  paths: {
    '/normalize': {
      post: {
        tags: ['Normalization'],
        summary: 'Normalize unstructured text into a structured JSON object',
        description: 'Extracts entities from raw paragraph or stat block text, maps them to the target schema, runs validation checks, and converts to MongoDB Shell format.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', example: 'Tiger\nLarge Beast, Unaligned\nArmor Class 12\nHit Points 37 (5d10 + 10)\nSpeed 40 ft.\nSTR 17 (+3) DEX 15 (+2) CON 14 (+2) INT 3 (-4) WIS 12 (+1) CHA 8 (-1)\nSkills Perception +3, Stealth +6\nSenses Darkvision 60 ft., passive Perception 13\nLanguages -\nChallenge 1 (200 XP)\nProficiency Bonus +2' },
                  template: { type: 'string', example: 'monster', description: 'Predefined schema: monster, magical-item, weapon, armor, item, spell, species, class, subclass, feat, background' },
                  schema: { type: 'object', description: 'Custom target JSON schema (used if template is omitted)' },
                  options: {
                    type: 'object',
                    properties: {
                      specificProvider: { type: 'string', example: 'groq', description: 'Force a specific provider instead of automatic cascading' },
                      targetLocale: { type: 'string', example: 'pt-BR', description: 'Translate natural language descriptions to locale (pt-BR, es, fr, none)' },
                      autoSplit: { type: 'boolean', default: true, description: 'Automatically split multiple creatures or items into separate objects' },
                      chunked: { type: 'boolean', default: true, description: 'Break complex monsters into semantic passes (Header, Traits, Actions, Legendary)' },
                      allowMock: { type: 'boolean', default: true, description: 'Allow deterministic rule extractor fallback if all AI providers fail' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful normalization',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                    mongoShell: { type: 'string' },
                    provider: { type: 'string', example: 'Groq' },
                    latencyMs: { type: 'number', example: 420 },
                    validation: { type: 'object' }
                  }
                }
              }
            }
          },
          '400': { description: 'Bad request (missing text)' },
          '500': { description: 'Normalization error' }
        }
      }
    },
    '/normalize/batch': {
      post: {
        tags: ['Normalization'],
        summary: 'Batch normalize multiple items sequentially',
        description: 'Processes an array of raw text paragraphs with pacing and caching.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['text'],
                      properties: {
                        text: { type: 'string' },
                        template: { type: 'string', default: 'monster' },
                        schema: { type: 'object' }
                      }
                    }
                  },
                  options: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Batch normalization results' }
        }
      }
    },
    '/validate': {
      post: {
        tags: ['Validation'],
        summary: 'Run validation checks on existing JSON data (zero AI cost)',
        description: 'Sanitizes types, checks mandatory fields, and produces Mongo Shell format without calling AI.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: { type: 'object' },
                  template: { type: 'string', example: 'monster' },
                  schema: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Validation results and formatted data' }
        }
      }
    },
    '/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List all predefined schema templates',
        responses: {
          '200': {
            description: 'List of registered templates',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    templates: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/templates/{name}': {
      get: {
        tags: ['Templates'],
        summary: 'Get schema and sample raw text for a specific template',
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'monster' }
        ],
        responses: {
          '200': { description: 'Template schema definition and sample input' },
          '404': { description: 'Template not found' }
        }
      }
    },
    '/database/status': {
      get: {
        tags: ['Providers & Database'],
        summary: 'Check database store status and engine',
        description: 'Returns whether the store is connected to MongoDB or local JSON file, plus count of tracked, available, and cooldown providers.',
        responses: {
          '200': {
            description: 'Database status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    status: {
                      type: 'object',
                      properties: {
                        enabled: { type: 'boolean', example: true },
                        engine: { type: 'string', example: 'mongodb' },
                        connected: { type: 'boolean', example: true },
                        providerCount: { type: 'number', example: 8 },
                        availableCount: { type: 'number', example: 8 },
                        inCooldownCount: { type: 'number', example: 0 },
                        invalidCount: { type: 'number', example: 0 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/database/providers': {
      get: {
        tags: ['Providers & Database'],
        summary: 'List all tracked AI providers with real-time status and cooldowns',
        parameters: [
          { name: 'showKeys', in: 'query', schema: { type: 'boolean', default: false }, description: 'Reveal full API keys instead of masked keys' }
        ],
        responses: {
          '200': {
            description: 'List of all tracked AI providers and status'
          }
        }
      },
      post: {
        tags: ['Providers & Database'],
        summary: 'Add or update a provider',
        description: 'Creates a new provider or updates an existing one (keys, models, baseUrl, metadata). Automatically registers dynamic providers in the active rotation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'string', example: 'fireworks' },
                  name: { type: 'string', example: 'Fireworks AI' },
                  providerType: { type: 'string', example: 'openai-compatible' },
                  apiKey: { type: 'string' },
                  baseUrl: { type: 'string', example: 'https://api.fireworks.ai/inference/v1' },
                  model: { type: 'string', example: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
                  isValid: { type: 'boolean', default: true },
                  isAvailable: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Provider upserted successfully' }
        }
      }
    },
    '/database/providers/{id}': {
      get: {
        tags: ['Providers & Database'],
        summary: 'Get details for a single provider',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' },
          { name: 'showKeys', in: 'query', schema: { type: 'boolean', default: false } }
        ],
        responses: {
          '200': { description: 'Provider details' },
          '404': { description: 'Provider not found' }
        }
      },
      delete: {
        tags: ['Providers & Database'],
        summary: 'Delete a custom provider',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Provider removed' }
        }
      }
    },
    '/database/providers/{id}/toggle': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Tick provider on or off manually',
        description: 'If turned off manually, it stays off across restarts until manually turned back on.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['enabled'],
                properties: {
                  enabled: { type: 'boolean', description: 'True to enable, False to disable' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Provider state updated' }
        }
      }
    },
    '/database/providers/{id}/cooldown': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Set persistent cooldown timestamp on a provider',
        description: 'Supports duration in seconds, days, exact until ISO date, or rateLimitType "month" (until 1st of next month UTC).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  seconds: { type: 'number', example: 3600 },
                  days: { type: 'number', example: 1 },
                  until: { type: 'string', format: 'date-time' },
                  rateLimitType: { type: 'string', enum: ['minute', 'day', 'month', 'manual'], example: 'month' },
                  reason: { type: 'string', example: 'Monthly quota exhausted' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Cooldown set successfully' }
        }
      }
    },
    '/database/providers/{id}/reset': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Clear cooldown for a provider and restore it to active rotation',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' }
        ],
        responses: {
          '200': { description: 'Cooldown cleared' }
        }
      }
    },
    '/database/providers/{id}/validity': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Mark provider valid or invalid',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isValid'],
                properties: {
                  isValid: { type: 'boolean' },
                  validationError: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Validity flag updated' }
        }
      }
    },
    '/database/providers/{id}/test': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Test provider connection and measure response latency',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'groq' }
        ],
        responses: {
          '200': { description: 'Test result with latency and response snippet' }
        }
      }
    },
    '/database/sync': {
      post: {
        tags: ['Providers & Database'],
        summary: 'Re-sync provider store from .env file',
        responses: {
          '200': { description: 'Store synced with .env' }
        }
      }
    },
    '/cache/stats': {
      get: {
        tags: ['Cache & Diagnostics'],
        summary: 'Get cache hit/miss statistics',
        responses: {
          '200': { description: 'Cache statistics' }
        }
      }
    },
    '/cache/clear': {
      post: {
        tags: ['Cache & Diagnostics'],
        summary: 'Clear normalization cache',
        responses: {
          '200': { description: 'Cache cleared' }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Cache & Diagnostics'],
        summary: 'Health check status',
        responses: {
          '200': { description: 'Service health status' }
        }
      }
    }
  }
};
