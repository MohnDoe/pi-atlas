import type { AssistantMessage, ToolCall, ToolResultMessage } from "@earendil-works/pi-ai";
import type { SessionAgg } from "../../types";

export const DEFAULT_ASSISTANT_MESSAGE_API: AssistantMessage["api"] = "openai-completions";
export const DEFAULT_ASSISTANT_MESSAGE_PROVIDER: AssistantMessage["provider"] = "deepseek";
export const DEFAULT_ASSISTANT_MESSAGE_MODEL: AssistantMessage["model"] = "deepseek-v4-pro";

export function makeAssistantMessage(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: "assistant",
    content: overrides.content ?? [],
    api: overrides.api ?? DEFAULT_ASSISTANT_MESSAGE_API,
    provider: overrides.provider ?? DEFAULT_ASSISTANT_MESSAGE_PROVIDER,
    model: overrides.model ?? DEFAULT_ASSISTANT_MESSAGE_MODEL,
    usage: overrides.usage ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: overrides.stopReason ?? "stop",
    timestamp: overrides.timestamp ?? 1700000000000,
  };
}

// Helper: minimal ToolResultMessage with required fields
export function makeToolResult(overrides: Partial<ToolResultMessage> = {}): ToolResultMessage {
  return {
    role: "toolResult",
    toolName: overrides.toolName ?? "bash",
    toolCallId: overrides.toolCallId ?? "c1",
    content: overrides.content ?? [],
    isError: false,
    timestamp: 1700000000000,
  };
}

// Helper: minimal ToolCall block
export function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    type: "toolCall",
    id: overrides.id ?? "tc1",
    name: overrides.name ?? "tool-name",
    arguments: overrides.arguments ?? {},
  };
}
