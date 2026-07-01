import type { SessionAgg } from "../../types";

export function makeSessionAgg(
  overrides: Partial<SessionAgg> & { sessionId: SessionAgg["sessionId"] },
): SessionAgg {
  const ts = overrides.timestamp ?? new Date().toISOString();
  return {
    timestamp: ts,
    sessionId: overrides.sessionId,
    project: overrides.project ?? "",
    cwd: overrides.cwd ?? "",
    models: overrides.models ?? {},
    userMsgs: overrides.userMsgs ?? 0,
    toolResults: overrides.toolResults ?? 0,
    compactionCount: overrides.compactionCount ?? 0,
    compactedTokens: overrides.compactedTokens ?? 0,
    modelChanges: overrides.modelChanges ?? 0,
    thinkingLevelCount: overrides.thinkingLevelCount ?? {},
  };
}
