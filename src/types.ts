// ---- Core data model ----

export interface DayAgg {
  date: string; // "YYYY-MM-DD"
  cost: number;
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
  projectCost: Record<string, number>;
  projectSessions: Record<string, Set<string>>;
  toolCount: Record<string, number>;
}

export type TimeRange = "1d" | "7d" | "30d" | "All";

export interface DaySpend {
  date: string; // "YYYY-MM-DD"
  cost: number;
}

export interface LangStat {
  language: string;
  lines: number;
  edits: number;
}

export interface ModelStat {
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
  tool: string;
  count: number;
}

export interface StatsSummary {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
  todayCost: number;
  languages: LangStat[];
  models: ModelStat[];
  projects: ProjectStat[];
  tools: ToolStat[];
  dailySpend: DaySpend[];
}

export interface CachePayload {
  signature: string;
  generatedAt: string;
  days: SerializedDayAgg[];
}

export interface SerializedDayAgg extends Omit<DayAgg, "sessionIds" | "projectSessions"> {
  sessionIds: string[];
  projectSessions: Record<string, string[]>;
}
