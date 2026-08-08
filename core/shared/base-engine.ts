import type { AnalysisResult, ColorKey, GameCalculation, ParseResult, Scores, SolverEngine, TurnInput } from "./types";

export const TOTAL_TURNS = 16;
export const TARGET_SCORE = 26;
export const COLOR_KEYS = ["blue", "green", "red"] as const;
export const REPLY_TYPES = ["СС", "ЗЗ", "КК", "СЗ", "СК", "ЗК"] as const;

const COLOR_BY_LETTER = { С: "blue", З: "green", К: "red" } as const;
const LATIN_TO_CYRILLIC: Readonly<Record<string, string>> = { C: "С", S: "С", Z: "З", K: "К" };
const LETTER_ORDER: Readonly<Record<string, number>> = { С: 0, З: 1, К: 2 };

export interface TransitionResult {
  scores: Scores;
  contribution: Scores;
  shared: number;
  balance: number;
  gain: number;
}

function emptyScores(): Scores {
  return { blue: 0, green: 0, red: 0 };
}

export abstract class BaseEngine implements SolverEngine {
  public readonly totalTurns = TOTAL_TURNS;
  public readonly targetScore = TARGET_SCORE;
  public readonly colorKeys = COLOR_KEYS;
  public readonly replyTypes = REPLY_TYPES;
  private readonly strategyMemo = new Map<string, number>();

  protected constructor(public readonly version: string) {}

  private mapLetters(value: string): string {
    return value.toUpperCase().replace(/[CSZK]/g, (letter) => LATIN_TO_CYRILLIC[letter] ?? letter);
  }

  public normalizeText(value: string): string {
    return this.mapLetters(value).trim();
  }

  public sanitizeReplyInput(value: string): string {
    return this.mapLetters(value)
      .replace(/[^СЗК]/g, "")
      .slice(0, 2);
  }

  public sanitizeOptionsInput(value: string): string {
    const mapped = this.mapLetters(value);
    const hasTrailingSpace = /\s$/.test(mapped);
    const tokens = mapped
      .split(/\s+/)
      .map((token) => token.replace(/[^СЗК]/g, "").slice(0, 2))
      .filter(Boolean)
      .slice(0, 3);
    const last = tokens.at(-1) ?? "";
    const keepSpace = hasTrailingSpace && tokens.length > 0 && tokens.length < 3 && last.length === 2;
    return tokens.join(" ") + (keepSpace ? " " : "");
  }

  public replySignature(reply: string): string {
    return [...reply].sort((first, second) => LETTER_ORDER[first] - LETTER_ORDER[second]).join("");
  }

  public parseReply(value: string): ParseResult<string> {
    const normalized = this.normalizeText(value);
    if (!/^[СЗК]{2}$/.test(normalized)) {
      return { ok: false, error: "Реплика должна состоять ровно из двух букв: С, З или К." };
    }
    return { ok: true, value: normalized };
  }

  public parseOptions(value: string): ParseResult<string[]> {
    const parts = this.normalizeText(value).split(/\s+/).filter(Boolean);
    if (parts.length !== 3) {
      return { ok: false, error: "Введите ровно три реплики, разделяя их пробелами." };
    }
    const replies: string[] = [];
    for (const part of parts) {
      const parsed = this.parseReply(part);
      if (!parsed.ok) return parsed;
      replies.push(parsed.value);
    }
    const signatures = replies.map((reply) => this.replySignature(reply));
    if (new Set(signatures).size !== signatures.length) {
      return { ok: false, error: "Все три варианта должны отличаться. КЗ и ЗК считаются одной репликой." };
    }
    return { ok: true, value: replies };
  }

  private requireReply(value: string, context: string): string {
    const parsed = this.parseReply(value);
    if (!parsed.ok) throw new TypeError(`${context}: ${parsed.error}`);
    return parsed.value;
  }

  private requireHistory(turns: readonly TurnInput[]): void {
    if (turns.length > this.totalTurns) {
      throw new RangeError(`История не может содержать больше ${this.totalTurns} реплик.`);
    }
  }

  public replyContribution(reply: string): Scores {
    const result = emptyScores();
    const first = COLOR_BY_LETTER[reply[0] as keyof typeof COLOR_BY_LETTER];
    const second = COLOR_BY_LETTER[reply[1] as keyof typeof COLOR_BY_LETTER];
    if (!first || !second) return result;
    if (first === second) result[first] = 2;
    else {
      result[first] += 1;
      result[second] += 1;
    }
    return result;
  }

  public hasSharedColor(firstReply: string | null, secondReply: string): boolean {
    if (!firstReply) return false;
    return [...new Set(secondReply)].some((letter) => firstReply.includes(letter));
  }

  public balanceBonus(scores: Scores, contribution: Scores): number {
    const allEqual = scores.blue === scores.green && scores.green === scores.red;
    const currentReplyChangedColor = COLOR_KEYS.some((key) => contribution[key] > 0);
    if (allEqual && scores.blue >= 2 && currentReplyChangedColor) return 2;
    const pairs: readonly (readonly [ColorKey, ColorKey])[] = [
      ["blue", "green"],
      ["blue", "red"],
      ["green", "red"]
    ];
    const hasActivePair = pairs.some(
      ([first, second]) =>
        scores[first] === scores[second] && scores[first] >= 2 && (contribution[first] > 0 || contribution[second] > 0)
    );
    return hasActivePair ? 1 : 0;
  }

  protected transition(
    scores: Scores,
    previousReply: string | null,
    reply: string,
    hasPrevious: boolean
  ): TransitionResult {
    const contribution = this.replyContribution(reply);
    const nextScores = { ...scores };
    COLOR_KEYS.forEach((key) => {
      nextScores[key] += contribution[key];
    });
    const shared = hasPrevious && this.hasSharedColor(previousReply, reply) ? 1 : 0;
    const balance = hasPrevious ? this.balanceBonus(nextScores, contribution) : 0;
    return { scores: nextScores, contribution, shared, balance, gain: shared + balance };
  }

  protected scoreSpread(scores: Scores): number {
    const values = COLOR_KEYS.map((key) => scores[key]);
    return Math.max(...values) - Math.min(...values);
  }

  public calculateState(turns: readonly TurnInput[] = []): GameCalculation {
    this.requireHistory(turns);
    const scores = emptyScores();
    let audience = 0;
    let previous: string | null = null;
    const calculatedTurns = turns.map((turn, index) => {
      const reply = this.requireReply(turn.reply, `Реплика ${index + 1}`);
      const result = this.transition(scores, previous, reply, index > 0);
      Object.assign(scores, result.scores);
      audience += result.gain;
      previous = reply;
      return {
        ...turn,
        reply,
        number: index + 1,
        contribution: result.contribution,
        shared: result.shared,
        balance: result.balance,
        gain: result.gain,
        audienceAfter: audience,
        scoresAfter: { ...scores }
      };
    });
    return { scores, audience, previous, calculatedTurns };
  }

  public bestFutureGain(scores: Scores, previousReply: string, turnsRemaining: number): number {
    if (!Number.isInteger(turnsRemaining) || turnsRemaining < 0 || turnsRemaining > this.totalTurns) {
      throw new RangeError(`Количество оставшихся ходов должно быть целым числом от 0 до ${this.totalTurns}.`);
    }
    const normalizedPrevious = this.requireReply(previousReply, "Предыдущая реплика");
    return this.memoizedBestFutureGain(scores, normalizedPrevious, turnsRemaining);
  }

  private memoizedBestFutureGain(scores: Scores, previousReply: string, turnsRemaining: number): number {
    if (turnsRemaining === 0) return 0;
    const key = `${turnsRemaining}|${scores.blue},${scores.green},${scores.red}|${this.replySignature(previousReply)}`;
    const cached = this.strategyMemo.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const reply of REPLY_TYPES) {
      const result = this.transition(scores, previousReply, reply, true);
      best = Math.max(best, result.gain + this.memoizedBestFutureGain(result.scores, reply, turnsRemaining - 1));
    }
    this.strategyMemo.set(key, best);
    return best;
  }

  public analyzeOptions(turns: readonly TurnInput[], options: readonly string[]): AnalysisResult[] {
    const current = this.calculateState(turns);
    if (turns.length === this.totalTurns || options.length === 0) return [];
    const futureTurns = Math.max(0, TOTAL_TURNS - turns.length - 1);
    const results = options.map((option, optionIndex) => {
      const reply = this.requireReply(option, `Вариант ${optionIndex + 1}`);
      const stateAfter = this.calculateState([...turns, { reply, type: "controlled" }]);
      const calculatedTurn = stateAfter.calculatedTurns.at(-1);
      if (!calculatedTurn) throw new Error("Не удалось рассчитать добавленную реплику.");
      const projectedGain = calculatedTurn.gain + this.bestFutureGain(stateAfter.scores, reply, futureTurns);
      return {
        ...calculatedTurn,
        reply,
        spread: this.scoreSpread(stateAfter.scores),
        stateAfter,
        projectedGain,
        projectedAudience: current.audience + projectedGain,
        isBest: false
      };
    });
    const bestProjection = Math.max(...results.map((result) => result.projectedGain));
    return results.map((result) => ({ ...result, isBest: result.projectedGain === bestProjection }));
  }

  public clearStrategyCache(): void {
    this.strategyMemo.clear();
  }
}
