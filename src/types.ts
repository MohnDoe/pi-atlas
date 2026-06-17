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
  providerCost: Record<string, number>;
  providerCount: Record<string, number>;
  modelToProvider: Map<string, string>;
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
  tool: string;
  count: number;
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
  dailySpend: DaySpend[];
}

export interface CachePayload {
  signature: string;
  generatedAt: string;
  days: SerializedDayAgg[];
}

export interface SerializedDayAgg extends Omit<DayAgg, "sessionIds" | "projectSessions" | "modelToProvider"> {
  sessionIds: string[];
  projectSessions: Record<string, string[]>;
  modelToProvider: Record<string, string>;
}

export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface ToolCallBlock {
  readonly type: "toolCall";
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolCallBlock;

export interface UsageCost {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly total: number;
}

export interface Usage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly totalTokens: number;
  readonly cost?: UsageCost;
}

export interface UserMessageBody {
  readonly role: "user";
  readonly content?: readonly ContentBlock[];
}

export interface ToolResultMessageBody {
  readonly role: "toolResult";
  readonly content?: readonly ContentBlock[];
  readonly toolName?: string;
  readonly toolCallId?: string;
}

export interface AssistantMessageBody {
  readonly role: "assistant";
  readonly content?: readonly ContentBlock[];
  readonly model?: string;
  readonly provider?: string;
  readonly timestamp?: number;
  readonly usage?: Usage;
}

export type MessageBody = UserMessageBody | ToolResultMessageBody | AssistantMessageBody;

export interface SessionEntry {
  readonly type: "session";
  readonly version: number;
  readonly id: string;
  readonly timestamp: string;
  readonly cwd?: string;
}

export interface MessageEntry {
  readonly type: "message";
  readonly id: string;
  readonly parentId?: string;
  readonly timestamp: string;
  readonly message: MessageBody;
}

export type SessionLogEntry = SessionEntry | MessageEntry;

export type SessionProjectMap = Map<string, string>;
