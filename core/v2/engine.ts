import { BaseEngine, type IdealRoute, type StrategySolverEngine, type TurnInput } from "../shared";
import manifest from "./package.json";

export class Engine extends BaseEngine implements StrategySolverEngine {
  public constructor(version = manifest.version) {
    super(version);
  }

  public buildIdealChain(turns: readonly TurnInput[]): IdealRoute {
    const current = this.calculateState(turns);
    let scores = { ...current.scores };
    let previousReply = current.previous;
    let hasPrevious = turns.length > 0;
    let projectedAudience = current.audience;
    const steps = [];
    const remaining = this.totalTurns - turns.length;
    for (let offset = 0; offset < remaining; offset += 1) {
      const futureTurns = remaining - offset - 1;
      const choice = this.replyTypes
        .map((reply, order) => {
          const result = this.transition(scores, previousReply, reply, hasPrevious);
          return {
            reply,
            order,
            result,
            totalGain: result.gain + this.bestFutureGain(result.scores, reply, futureTurns),
            spread: this.scoreSpread(result.scores)
          };
        })
        .sort(
          (first, second) =>
            second.totalGain - first.totalGain ||
            second.result.gain - first.result.gain ||
            first.spread - second.spread ||
            first.order - second.order
        )[0];
      if (!choice) throw new Error("Невозможно построить маршрут без доступных типов реплик.");
      projectedAudience += choice.result.gain;
      steps.push({
        number: turns.length + offset + 1,
        reply: choice.reply,
        gain: choice.result.gain,
        audienceAfter: projectedAudience
      });
      scores = choice.result.scores;
      previousReply = choice.reply;
      hasPrevious = true;
    }
    return { steps, finalAudience: projectedAudience, canWin: projectedAudience >= this.targetScore };
  }
}

const engine = new Engine();
export default engine;
