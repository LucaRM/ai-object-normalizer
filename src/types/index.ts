export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class NormalizerError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public provider?: string,
    public retryAfterSeconds?: number,
    public rawError?: any
  ) {
    super(message);
    this.name = 'NormalizerError';
  }
}

export interface NormalizeOptions {
  /**
   * Predefined template name (e.g. 'monster', 'spell', 'item')
   */
  template?: string;

  /**
   * Target locale for embedded translations (e.g. 'pt-BR', 'es')
   */
  targetLocale?: string;

  /**
   * Source text locale (defaults to 'en')
   */
  sourceLocale?: string;

  /**
   * Specific provider to use (skips cascading fallback if set)
   */
  specificProvider?: string;

  /**
   * System / Edition identifier string to echo into output document (e.g. 'D&D 5.5e' or 'D&D 5e (2014)')
   */
  system?: string;

  /**
   * Rules edition (e.g. '2024' or '2014')
   */
  edition?: string;

  /**
   * Default values to enrich the normalized object with
   */
  defaults?: Record<string, any>;

  /**
   * Desired output format:
   * - 'json': standard clean JavaScript / JSON object
   * - 'mongo-shell': string representation with ObjectId(...), NumberInt(...), ISODate(...)
   * - 'mongo-extended': MongoDB Extended JSON v2 format
   * - 'all': returns all formats
   */
  format?: 'json' | 'mongo-shell' | 'mongo-extended' | 'all';

  /**
   * If true, throws an error when validation property checks fail.
   * If false (default), sanitizes/fixes fields where possible and returns warnings.
   */
  /**
   * Automatically detect and split multiple entities (e.g. multiple monsters) in the text
   */
  autoSplit?: boolean;

  /**
   * Break large entity text into semantic parts (header, traits, actions, legendary),
   * normalize each part individually, and stitch them back together.
   * Eliminates AI output token limits and hallucination for complex monsters/classes.
   */
  chunked?: boolean;

  /**
   * Skip cache retrieval and force fresh normalization
   */
  skipCache?: boolean;

  /**
   * Custom cache TTL in milliseconds for this request
   */
  cacheTtlMs?: number;

  /**
   * If true, throws an error when validation property checks fail.
   * If false (default), sanitizes/fixes fields where possible and returns warnings.
   */
  strict?: boolean;

  /**
   * Optional custom property check rules to execute
   */
  customChecks?: CustomCheckRule[];

  /**
   * If false (default), the cascade will never silently fall back to synthetic Mock data.
   * If all AI providers fail or are rate-limited, an error is returned.
   * Set to true to allow offline rule-based deterministic fallback.
   */
  allowMock?: boolean;

  /**
   * Minimum waiting period in milliseconds between consecutive calls to external AI providers.
   * Prevents API lockout. Defaults to 1500ms (or process.env.PROVIDER_MIN_INTERVAL_MS).
   */
  minIntervalMs?: number;

  /**
   * Default cooldown duration in seconds when an AI provider returns a rate-limit (429) without an explicit retry time.
   * Defaults to 60 seconds (or process.env.DEFAULT_COOLDOWN_SECONDS).
   */
  defaultCooldownSeconds?: number;

  /**
   * Cooldown duration in seconds when an AI provider exhausts its daily token / request quota.
   * If not set, automatically calculates seconds until next UTC midnight reset (between 4h and 24h).
   */
  dailyCooldownSeconds?: number;

  /**
   * Internal timeout in milliseconds for each external provider call before failing over.
   * Defaults to 12000ms.
   */
  providerTimeoutMs?: number;
}

export interface CustomCheckRule {
  name: string;
  field: string;
  validator: (value: any, obj: any) => boolean | string;
  fixer?: (value: any, obj: any) => any;
}

export interface CoercedField {
  path: string;
  original: any;
  coerced: any;
  reason: string;
}

export interface EntityRelation {
  field: string;
  targetCollection: string;
  value: string | string[];
}

export interface ValidationResult {
  isValid: boolean;
  checksRun: number;
  coercedFields: CoercedField[];
  warnings: string[];
  errors: string[];
}

export interface NormalizerProvider {
  name: string;
  isAvailable(): boolean;
  setAvailable?(state: boolean): void;
  normalize(text: string, schema: any, options: NormalizeOptions): Promise<string>;
}

export interface NormalizeResult<T = any> {
  success: boolean;
  data: T;
  mongoShell?: string;
  mongoExtended?: any;
  provider: string;
  latencyMs: number;
  validation: ValidationResult;
  relations?: EntityRelation[];
  cached?: boolean;
  chunked?: boolean;
  chunksProcessed?: string[];
  usedFallback?: boolean;
  isMock?: boolean;
  attemptedProviders?: string[];
}

export interface AutoSplitNormalizeResult {
  success: boolean;
  autoSplit: true;
  count: number;
  entities: any[];
  results: NormalizeResult[];
  mongoShell?: string;
  durationMs: number;
}

export interface BatchNormalizeResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  durationMs: number;
  results: Array<{
    index: number;
    success: boolean;
    result?: NormalizeResult;
    error?: string;
  }>;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  type?: 'cloud' | 'local' | 'mock';
  models?: string[];
  inCooldown?: boolean;
  cooldownRemainingSeconds?: number;
  cooldownReason?: string;
  cooldownUntil?: string;
  isValid?: boolean;
}

// ==========================================
// 1. SPELL MECHANICS
// ==========================================
export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic'
  | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';
export type SpellDie = 4 | 6 | 8 | 10 | 12 | 20;

export interface SpellMechanics {
  version: 1;
  attack?: { kind: 'melee' | 'ranged'; rolls: number };
  save?: { ability: Ability; onSuccess: 'half' | 'none' | 'other' };
  effects?: SpellEffect[];
  targets?: { count: number; kind: 'creature' | 'object' | 'point' | 'self'; upTo?: boolean };
  area?: { shape: 'cone' | 'cube' | 'cylinder' | 'emanation' | 'line' | 'sphere'; size: number };
  higherLevels?: HigherLevelRule;
  cantripScaling?: CantripScaling;
}

export interface SpellEffect {
  id: string; // 'main', 'secondary', 'ongoing', 'explosion', etc.
  kind: 'damage' | 'healing' | 'tempHp' | 'maxHp';
  dice?: { count: number; die: SpellDie };
  flat?: number;
  addSpellcastingModifier?: boolean;
  damageType?: DamageType;
  when?: 'onCast' | 'onHit' | 'onFailedSave' | 'startOfTurn' | 'endOfTurn' | 'other';
}

export interface HigherLevelRule {
  aboveLevel: number;
  every?: number;
  perStep?: {
    effectDice?: { effectId: string; count: number; die: SpellDie }[];
    flat?: { effectId: string; amount: number }[];
    targets?: number;
    attackRolls?: number;
    areaSize?: number;
  };
  atLevel?: { level: number; duration?: string; concentration?: boolean }[];
}

export interface CantripScaling {
  characterLevels: number[]; // [5, 11, 17]
  perStep: {
    effectDice?: { effectId: string; count: number; die: SpellDie }[];
    attackRolls?: number;
  };
}

// ==========================================
// 2. USES RECHARGE & MAX USES (Items & Features)
// ==========================================
export type RechargeDie = 2 | 3 | 4 | 6 | 8 | 10 | 12 | 20;

export interface DiceRecharge {
  dice: { count: number; die: RechargeDie };
  flat?: number;
}

export type RechargeAmount = 'all' | 'none' | number | DiceRecharge;

export interface UsesRecharge {
  shortRest?: RechargeAmount;
  longRest?: RechargeAmount;
  dawn?: RechargeAmount;
  dusk?: RechargeAmount;
  fromLevel?: {
    level: number;
    scope: 'class' | 'character';
    recharge: {
      shortRest?: RechargeAmount;
      longRest?: RechargeAmount;
      dawn?: RechargeAmount;
      dusk?: RechargeAmount;
    };
  }[];
}

export type FeatureMaxUses =
  | number
  | { type: 'static'; value: number }
  | { type: 'proficiencyBonus'; multiplier?: number }
  | {
      type: 'abilityModifier';
      ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma' | 'spellcasting';
      multiplier?: number;
      minimum?: number;
    }
  | { type: 'characterLevel'; multiplier?: number }
  | {
      type: 'classLevel';
      multiplier?: number;
      classSourceId?: string;
      subclassSourceId?: string;
    };

// ==========================================
// 3. SPELL ACTIVE EFFECT
// ==========================================
export type ActiveEffectDurationUnit =
  | 'round'
  | 'minute'
  | 'hour'
  | 'day'
  | 'untilDispelled'
  | 'untilStartOfNextTurn'
  | 'special';

export interface ActiveEffectDuration {
  unit: ActiveEffectDurationUnit;
  amount?: number;
}

export type ActiveEffectEndEvent =
  | 'donsArmor'
  | 'takesDamage'
  | 'attacksOrCasts'
  | 'savesSucceeds'
  | 'dropsTo0Hp';

export interface ActiveEffectRepeatSave {
  ability: Ability;
  when: 'endOfTurn' | 'startOfTurn' | 'whenDamaged';
}

export type ActiveEffectModifier =
  | { type: 'ac'; mode: 'bonus'; value: number }
  | { type: 'ac'; mode: 'setBase'; value: number; addAbility?: 'DEX' | Ability; requiresNoArmor?: boolean }
  | { type: 'ac'; mode: 'minimum'; value: number }
  | {
      type: 'rollMode';
      mode: 'advantage' | 'disadvantage';
      roll: 'attack' | 'save' | 'check' | 'initiative';
      abilities?: Ability[];
      against?: boolean;
    }
  | {
      type: 'rollBonus';
      roll: 'attack' | 'save';
      abilities?: 'all' | Ability[];
      dice?: { count: number; die: SpellDie };
      sign?: 1 | -1;
      value?: number;
    }
  | {
      type: 'speed';
      mode: 'multiply' | 'bonus' | 'set';
      value: number;
      movement?: 'all' | 'fly' | 'climb';
    }
  | { type: 'hpMax'; value: number; alsoCurrent?: boolean }
  | {
      type: 'tempHp';
      value?: number;
      dice?: { count: number; die: SpellDie };
      addSpellcastingModifier?: boolean;
      when?: 'onApply' | 'startOfTurn';
    }
  | {
      type: 'resistance' | 'immunity';
      damageTypes: DamageType[] | { fromChoice: string };
    }
  | { type: 'conditionImmunity'; conditions: string[] }
  | { type: 'applyCondition'; condition: string }
  | {
      type: 'damageBonus';
      dice: { count: number; die: SpellDie };
      damageType?: DamageType;
      on?: 'weaponHit' | string;
    }
  | {
      type: 'extraAction';
      actions: Array<'attackOneWeapon' | 'dash' | 'disengage' | 'hide' | 'utilize'>;
    }
  | {
      type: 'restriction';
      what:
        | 'noReactions'
        | 'actionOrBonusAction'
        | 'oneAttack'
        | 'noActions'
        | 'noMovement'
        | 'noSpeech'
        | 'cantConcentrate';
    }
  | {
      type: 'sense';
      sense: 'darkvision' | 'seeInvisible' | string;
      range?: number;
    };

export interface SpellActiveEffect {
  version: 1;
  appliesTo: 'self' | 'creature';
  duration: ActiveEffectDuration;
  concentration: boolean;
  endsWhen?: ActiveEffectEndEvent[];
  repeatSave?: ActiveEffectRepeatSave;
  modifiers: ActiveEffectModifier[];
  perSlotAbove?: {
    modifiers: ActiveEffectModifier[];
  };
  afterEnd?: {
    duration: ActiveEffectDuration;
    modifiers: ActiveEffectModifier[];
  };
}


