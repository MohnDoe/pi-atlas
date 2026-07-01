import type { Api, Model, Provider, Usage } from "@earendil-works/pi-ai";
import type { SessionHeader } from "@earendil-works/pi-coding-agent";

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
  provider: string;
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
  provider: Provider;
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

export interface SessionAgg {
  timestamp: SessionHeader["timestamp"];
  sessionId: SessionHeader["id"];
  project: string;
  cwd: SessionHeader["cwd"];
  models: Record<Provider, Record<Model<Api>["name"], SessionModelUsage>>;
  userMsgs: number;
  toolResults: number;
  compactionCount: number;
  compactedTokens: number;
  modelChanges: number;
  thinkingLevelCount: Record<string, number>;
}

export interface SessionModelUsage {
  provider: Provider;
  api: Api;
  usage: Usage;
  calls: number;
  asstMsgs: number;
  tools: Record<string, number>; // tool name → call count
  languages: Record<string, LangUsage>;
}

export interface LangUsage {
  lines: number;
  edits: number;
}

export interface Filters {
  project?: string;
  model?: string;
  provider?: string;
}

export interface CachePayload {
  version: string;
  signature: string;
  generatedAt: string;
  sessions: SessionAgg[];
}
