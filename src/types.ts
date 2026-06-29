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
  dailySpend: DaySpend[];
  hourlySpend: HourSpend[];
}

// ---- New SessionAgg types ----

export interface SessionAgg {
  date: string;            // "YYYY-MM-DD"
  sessionId: string;
  project: string;
  models: Record<string, SessionModelUsage>; // keyed by model name
  userMsgs: number;
  toolResults: number;
  compactionCount: number;
  compactedTokens: number;
  modelChanges: number;
  thinkingLevelCount: Record<string, number>;
  hourCost: Record<number, number>;
}

export interface SessionModelUsage {
  provider: string;
  cost: number;
  calls: number;
  inTok: number;
  outTok: number;
  crTok: number;
  cwTok: number;
  asstMsgs: number;
  tools: Record<string, number>;             // tool name → call count
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
