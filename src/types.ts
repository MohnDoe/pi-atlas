export interface DayAgg {
  date: string; // "YYYY-MM-DD"
  cost: number;
  hourCost: Record<number, number>; // accumulated cost per UTC hour 0-23
  inTok: number;
  outTok: number;
  crTok: number;
  cwTok: number;
  userMsgs: number;
  asstMsgs: number;
  toolResults: number;
  sessionIds: Set<string>;
  langLines: Record<string, number>;
  langEdits: Record<string, number>;
  modelCost: Record<string, number>;
  modelCount: Record<string, number>;
  providerCost: Record<string, number>;
  providerCount: Record<string, number>;
  modelToProvider: Map<string, string>;
  projectCost: Record<string, number>;
  projectSessions: Record<string, Set<string>>;
  toolCount: Record<string, number>;
  /** Accumulated cost per skill name from assistant messages. */
  skillCost: Record<string, number>;
  /** Invocation count per skill name (detected from user message skill tags). */
  skillCount: Record<string, number>;
  /** Total tokens attributed to each skill. */
  skillTokens: Record<string, number>;
  /** Total tool calls attributed to each skill. */
  skillToolCount: Record<string, number>;
  /** Per-tool breakdown of tool calls per skill. */
  skillToolBreakdown: Record<string, Record<string, number>>;
  // New fields tracking pi session entry types beyond session+message
  compactionCount: number;
  compactedTokens: number;
  modelChanges: number;
  thinkingLevelCount: Record<string, number>;
}

export type TimeRange = "1d" | "7d" | "30d" | "All";

export interface DaySpend {
  date: string; // "YYYY-MM-DD"
  cost: number;
}

export interface HourSpend {
  hour: number; // 0-23
  cost: number;
}

export interface LangStat {
  language: string;
  lines: number;
  edits: number;
}

export interface ModelStat {
  provider?: string;
  model: string;
  cost: number;
  calls: number;
}

export interface ProjectStat {
  project: string;
  cost: number;
  sessions: number;
}

export interface ToolStat {
  name: string;
  count: number;
}

/** Aggregated stats for one skill across the selected time range. */
export interface SkillStat {
  /** Skill name (from the SKILL.md location path or the skill tag name). */
  name: string;
  /** Total cost attributed to this skill. */
  cost: number;
  /** Number of times the skill was invoked (user messages containing a skill tag). */
  invocations: number;
  /** Total tokens (input+output+cache) attributed to this skill. */
  tokens: number;
  /** Tool call statistics for this skill. */
  toolCalls: {
    /** Total tool calls attributed to this skill across all invocations. */
    total: number;
    /** Average tool calls per invocation. */
    avg: number;
    /** Breakdown of tool calls by tool name. */
    calls: Record<string, number>;
  };
}

export interface ProviderStat {
  provider: string;
  cost: number;
  calls: number;
}

export interface StatsSummary {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  daysActive: number;
  avgCostPerDay: number;
  todayCost: number;
  languages: LangStat[];
  models: ModelStat[];
  projects: ProjectStat[];
  tools: ToolStat[];
  providers: ProviderStat[];
  compactionCount: number;
  compactedTokens: number;
  modelChanges: number;
  thinkingLevelCount: Record<string, number>;
  /** Per-skill aggregated stats, sorted by cost descending. */
  skills: SkillStat[];
  dailySpend: DaySpend[];
  hourlySpend: HourSpend[];
}

export interface CachePayload {
  signature: string;
  generatedAt: string;
  days: SerializedDayAgg[];
}

export interface SerializedDayAgg extends Omit<
  DayAgg,
  "sessionIds" | "projectSessions" | "modelToProvider"
> {
  sessionIds: string[];
  projectSessions: Record<string, string[]>;
  modelToProvider: Record<string, string>;
}
