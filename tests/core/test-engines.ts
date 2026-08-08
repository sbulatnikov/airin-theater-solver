import type { SolverEngine, TurnInput } from "@airin-play/core/shared";
import engineV1 from "@airin-play/core/v1";
import engineV2 from "@airin-play/core/v2";

export const engines: ReadonlyArray<readonly [string, SolverEngine]> = [
  ["@airin-play/core/v1", engineV1],
  ["@airin-play/core/v2", engineV2]
];

export function asTurns(replies: readonly string[]): TurnInput[] {
  return replies.map((reply) => ({ reply, type: "controlled" }));
}
