import type { Usage } from "@earendil-works/pi-ai";

/**
 * Merge two Usage objects by summing all numeric fields.
 * Returns a new object — does not mutate either argument.
 */
export function mergeUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    totalTokens: a.totalTokens + b.totalTokens,
    cost: {
      total: a.cost.total + b.cost.total,
      cacheRead: a.cost.cacheRead + b.cost.cacheRead,
      cacheWrite: a.cost.cacheWrite + b.cost.cacheWrite,
      input: a.cost.input + b.cost.input,
      output: a.cost.output + b.cost.output,
    },
  };
}

export function emptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      total: 0,
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0,
    },
  };
}
