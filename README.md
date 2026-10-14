# Object Normalizer ⚡

> AI-powered structured object normalization and extraction service with **cascading provider failover**, **strict property checks**, and **MongoDB-ready document formatting**.

Inspired by and compatible with `automatic-translator`, this tool allows you to send an arbitrary model schema (or use built-in presets like D&D monsters, spells, items) and any unstructured raw text paragraph, and automatically normalize it into a validated object ready to save directly into MongoDB.

---

## 🌟 Key Features

1. **Cascading AI Failover**:
   - Built to run **100% out of the box with zero signup and zero API keys required**, just like `automatic-translator`!
   - Cascading provider sequence:
     1. `Pollinations AI` (Free True LLM - OpenAI / GPT-OSS, No API key or signup)
     2. `OVH Cloud AI` (Free Llama 3.3 70B & Mistral Nemo, No API key or signup)
     3. `Gemini` (If `GEMINI_API_KEY` configured)
     4. `Groq` (If `GROQ_API_KEY` configured)
     5. `OpenAI` (If `OPENAI_API_KEY` configured)
     6. `Anthropic Claude` (If `ANTHROPIC_API_KEY` configured)
     7. `OpenRouter` (If `OPENROUTER_API_KEY` configured)
     8. `Ollama` (Local model if enabled)
     9. `Mock / Rule Heuristic` (Offline rule-based fallback safety net)
   - If a provider encounters a rate limit (HTTP 429), quota issue, or network timeout, it logs the event, marks the provider temporarily unavailable, and automatically cascades to the next provider.
   - Option to lock to a specific provider via `specificProvider` (e.g. `"free"`, `"llama"`, `"pollinations"`, `"gemini"`) or request headers.

2. **Property Checks & Validation Pipeline**:
   - **Schema Compliance**: Validates required keys and properties against the target model.
   - **Type Coercion**: Automatically coerces string numbers (`"13"` → `13`), splits comma-separated strings into arrays, cleans speed strings (`"40 ft. (8 spaces)"` → `"40 ft."`), and validates ability score bounds.
   - **MongoDB Document Enrichment**: Generates valid 24-character hexadecimal `_id` (`ObjectId`), sets `createdAt` and `updatedAt` ISO dates, sets `createdBy: 'system'` and default `books: [ObjectId(...)]`.
   - **Zero-Key Embedded Translation**: Directly integrates with `automatic-translator` (port 3008) and free translation memory endpoints to translate entities into requested locales (e.g., `pt-BR`) with `_metadata` and `metadata` without requiring an API key.
   - **Diagnostics**: Returns `checksRun`, `coercedFields`, `warnings`, and `errors`.

3. **Multi-Format Export**:
   - **Clean JSON**: Standard JSON for Node.js backends and Mongoose.
   - **Mongo Shell**: Exact shell syntax with `ObjectId('...')`, `NumberInt('...')`, `ISODate('...')`.
   - **MongoDB Extended JSON**: Standard `$oid`, `$numberInt`, `$date` format.

4. **Interactive Web UI Playground**:
   - Built-in web dashboard at `http://localhost:3009/` with real-time feedback, presets, and copy/export actions.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configuration (Optional!)
Copy `.env.example` to `.env`. **No API keys or signup required to use the service!**
If you wish to use paid/keyed cloud models as fallbacks, you can optionally provide them:
```env
PORT=3009
# Optional Cloud Keys:
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```
*(Out of the box, the normalizer automatically runs on free keyless providers Pollinations and OVH Llama 3.3 70B, with zero signup required, exactly like automatic-translator! If offline, it seamlessly falls back to its built-in rule-based extractor.)*

### 3. Build & Run
```bash
# Build TypeScript
npm run build

# Start the server
npm start

# Or development mode with auto-reload
npm run dev
```

Visit **`http://localhost:3009/`** in your browser.

---

## 📚 Available Built-in Templates (Matching `luca-app`)

| Template Key | Category | Description | Key Extracted Fields |
| :--- | :--- | :--- | :--- |
| **`monster`** | Creatures | D&D 5e Monster stat block | `armorClass`, `hitPoints`, `speed`, `abilities` (STR/DEX/CON/INT/WIS/CHA), `skills`, `actions`, `cr` |
| **`magical-item`** | Equipment | Magical Weapons, Armor, Wondrous | `entityType`, `rarity`, `requiresAttunement`, `features`, `maxCharges`, `chargeResetOn`, base stats |
| **`species`** | Character Options | Species / Races (2024 / Legacy) | `size`, `baseSpeed`, `speed`, `creatureType`, `baseLanguages`, categorized `features` |
| **`class`** | Character Options | Player Class | `traits` (`hitDie`, `primaryAbility`, saving throws, skills, armor/weapons), `spellcasting`, `levelProgression` |
| **`subclass`** | Character Options | Class Archetype / Subclass | `classId`, `className`, `features` (with unlock level numbers), `spellList`, `specialMechanics` |
| **`feat`** | Character Options | Feats (Origin, General, Epic Boon) | `featType`, `prerequisite`, `abilityScoreIncrease`, `repeatable`, `features` |
| **`background`** | Character Options | Character Background | `feat` (origin feat reference), `abilityScoreIncrease`, `skillProficiency`, `toolProficiency`, `equipment` |
| **`weapon`** | Equipment | Weapons (2024 & Legacy) | `category`, `damage`, `damageType`, `weight`, `cost`, `properties`, `masteries` (2024 weapon masteries) |
| **`spell`** | Magic | Spells | `level`, `school`, `castingAction`, `castingTime`, `range`, `components`, `duration`, `classes`, `ritual`, `concentration` |
| **`item`** | Equipment | General Adventuring Gear | `cost`, `weight`, `description` |
| **`custom`** | Any | Any Custom Prototype Object | Caller passes arbitrary prototype object in `"schema": { ... }` |

---

## 📡 API Reference

### `POST /normalize`
Normalizes a raw text paragraph into a structured model object.

**Example: Normalizing a Magical Item**
```json
{
  "template": "magical-item",
  "text": "Flame Tongue\nWeapon (any sword), rare (requires attunement)\nYou can use a bonus action to speak this magic sword's command word, causing flames to erupt from the blade...",
  "options": {
    "targetLocale": "pt-BR",
    "format": "all"
  }
}
```

**Example: Normalizing a Species / Race**
```json
{
  "template": "species",
  "text": "Elf\nCreature Type: Humanoid\nSize: Medium\nSpeed: 30 feet\nLanguages: Common, Elvish\n\nDarkvision. You can see in dim light within 60 feet...\nFey Ancestry. You have Advantage on saving throws...",
  "options": {
    "targetLocale": "pt-BR",
    "format": "all"
  }
}
```

**Example: Normalizing a Class or Subclass**
```json
{
  "template": "class",
  "text": "Fighter\nPrimary Ability: Strength or Dexterity\nHit Point Die: 1d10 per Fighter level\nSaving Throw Proficiencies: Strength, Constitution...",
  "options": {
    "targetLocale": "pt-BR",
    "format": "all"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "68ee93a8e438bef68025fa54",
    "name": "Tiger",
    "type": "Beast",
    "size": "Large",
    "alignment": "Unaligned",
    "armorClass": 13,
    "hitPoints": 30,
    "speed": "40 ft.",
    "abilities": {
      "strength": 17,
      "dexterity": 16,
      "constitution": 14,
      "intelligence": 3,
      "wisdom": 12,
      "charisma": 8
    },
    "skills": ["Perception +3", "Stealth +7"],
    "savingThrows": [],
    "senses": "Darkvision 60 ft., Passive Perception 13",
    "languages": "—",
    "traits": [],
    "actions": [
      {
        "name": "Rend",
        "description": "Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage..."
      },
      {
        "name": "Nimble Escape",
        "description": "The tiger takes the Disengage or Hide action."
      }
    ],
    "reactions": [],
    "legendaryActions": [],
    "books": ["68e065e63483269c7c88180d"],
    "proficiencyBonus": 2,
    "damageResistances": "",
    "damageImmunities": "",
    "conditionImmunities": "",
    "createdBy": "system",
    "updatedBy": "system",
    "createdAt": "2025-10-14T18:17:12.021Z",
    "updatedAt": "2025-11-09T00:23:59.276Z",
    "translations": {
      "pt-BR": {
        "name": "Tigre",
        "traits": [],
        "type": "Besta",
        "alignment": "Não alinhado",
        "actions": [
          {
            "name": "Rasgar",
            "description": "Jogada de Ataque Corpo a Corpo: +5, alcance 1,5 m. Acerto: 10 (2d6 + 3) Dano cortante..."
          },
          {
            "name": "Fuga Ágil",
            "description": "O tigre realiza a ação Desengajar ou Esconder-se."
          }
        ],
        "reactions": [],
        "legendaryActions": [],
        "senses": "Visão no Escuro 18 metros, Percepção Passiva 13",
        "languages": "-",
        "_metadata": {
          "locale": "pt-BR",
          "translatedAt": "2025-10-17T00:56:24.243Z",
          "source": "AI_TRANSLATION",
          "quality": "DRAFT"
        },
        "metadata": {
          "reviewed": false,
          "translatedBy": "ai"
        }
      }
    }
  },
  "mongoShell": "{\n  _id: ObjectId('68ee93a8e438bef68025fa54'),\n  name: 'Tiger',\n  armorClass: NumberInt('13'),\n  hitPoints: NumberInt('30'),\n  ...\n}",
  "provider": "Gemini",
  "latencyMs": 420,
  "validation": {
    "isValid": true,
    "checksRun": 14,
    "coercedFields": [
      {
        "path": "speed",
        "original": "40 ft. (8 spaces)",
        "coerced": "40 ft.",
        "reason": "Cleaned speed to standard ft format"
      }
    ],
    "warnings": [],
    "errors": []
  }
}
```

---

### `POST /normalize/batch`
Batch processes multiple text blocks sequentially with progress tracking and combined diagnostic reporting.

---

### `POST /validate`
Executes property checks and type coercion on an existing JSON object without calling an AI model.

---

### `GET /templates`
Returns all predefined models (`monster`, `spell`, `item`) with sample schemas and raw example paragraphs.

---

### `GET /providers/all` & `POST /providers/reset`
Monitors and resets cascading provider availability states.

---

## 🛠️ Custom Model Schemas
You are not limited to built-in templates. You can pass ANY arbitrary prototype object in the `schema` property:

```json
{
  "schema": {
    "productName": "string",
    "sku": "string",
    "price": 0.00,
    "inStock": true,
    "tags": ["string"],
    "specifications": {
      "weight": "0kg"
    }
  },
  "text": "MacBook Pro 16 M3 Max, SKU MBP16-M3, priced at $3499.00 in stock now..."
}
```
The normalizer will enforce the exact keys, coerce the types according to the sample values, and return the cleaned object.
