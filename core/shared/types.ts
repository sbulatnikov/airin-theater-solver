export type ColorLetter = 'С' | 'З' | 'К';
export type ColorKey = 'blue' | 'green' | 'red';
export type TurnType = 'controlled' | 'anonymous';

export interface Scores {
  blue: number;
  green: number;
  red: number;
}

export interface TurnInput {
  reply: string;
  type: TurnType;
}

export interface CalculatedTurn extends TurnInput {
  number: number;
  contribution: Scores;
  shared: number;
  balance: number;
  gain: number;
  audienceAfter: number;
  scoresAfter: Scores;
}

export interface GameCalculation {
  scores: Scores;
  audience: number;
  previous: string | null;
  calculatedTurns: CalculatedTurn[];
}

export interface AnalysisResult extends CalculatedTurn {
  reply: string;
  spread: number;
  stateAfter: GameCalculation;
  projectedGain: number;
  projectedAudience: number;
  isBest: boolean;
}

export interface RouteStep {
  number: number;
  reply: string;
  gain: number;
  audienceAfter: number;
}

export interface IdealRoute {
  steps: RouteStep[];
  finalAudience: number;
  canWin: boolean;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SolverEngine {
  readonly version: string;
  readonly totalTurns: number;
  readonly targetScore: number;
  readonly colorKeys: readonly ColorKey[];
  readonly replyTypes: readonly string[];
  normalizeText(value: string): string;
  sanitizeReplyInput(value: string): string;
  sanitizeOptionsInput(value: string): string;
  replySignature(reply: string): string;
  parseReply(value: string): ParseResult<string>;
  parseOptions(value: string): ParseResult<string[]>;
  replyContribution(reply: string): Scores;
  hasSharedColor(firstReply: string | null, secondReply: string): boolean;
  balanceBonus(scores: Scores, contribution: Scores): number;
  calculateState(turns?: readonly TurnInput[]): GameCalculation;
  bestFutureGain(scores: Scores, previousReply: string, turnsRemaining: number): number;
  analyzeOptions(turns: readonly TurnInput[], options: readonly string[]): AnalysisResult[];
  clearStrategyCache(): void;
}

export interface StrategySolverEngine extends SolverEngine {
  buildIdealChain(turns: readonly TurnInput[]): IdealRoute;
}

export function isStrategySolverEngine(engine: SolverEngine): engine is StrategySolverEngine {
  return 'buildIdealChain' in engine && typeof engine.buildIdealChain === 'function';
}
