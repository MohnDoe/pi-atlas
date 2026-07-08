import { describe, expect, it } from "bun:test";
import { mergeUsage } from "./usage.helper";

describe("mergeUsage", () => {
  it("sums all scalar fields and nested cost fields", () => {
    const a = {
      input: 500,
      output: 200,
      cacheRead: 50,
      cacheWrite: 10,
      totalTokens: 700,
      cost: {
        total: 1.0,
        cacheRead: 0.1,
        cacheWrite: 0.1,
        input: 0.3,
        output: 0.5,
      },
    };

    const b = {
      input: 100,
      output: 50,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 150,
      cost: {
        total: 0.5,
        cacheRead: 0.1,
        cacheWrite: 0.1,
        input: 0.3,
        output: 0.5,
      },
    };

    const result = mergeUsage(a, b);

    expect(result).toEqual({
      input: 600,
      output: 250,
      cacheRead: 50,
      cacheWrite: 10,
      totalTokens: 850,
      cost: {
        total: 1.5,
        cacheRead: 0.2,
        cacheWrite: 0.2,
        input: 0.6,
        output: 1.0,
      },
    });
  });

  it("returns the same value when merging with a zero usage", () => {
    const a = {
      input: 500,
      output: 200,
      cacheRead: 50,
      cacheWrite: 10,
      totalTokens: 700,
      cost: {
        total: 1.0,
        cacheRead: 0.1,
        cacheWrite: 0.1,
        input: 0.3,
        output: 0.5,
      },
    };

    const zero = {
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

    expect(mergeUsage(a, zero)).toEqual(a);
  });

  it("doubles all fields when merging with itself", () => {
    const a = {
      input: 500,
      output: 200,
      cacheRead: 50,
      cacheWrite: 10,
      totalTokens: 700,
      cost: {
        total: 1.0,
        cacheRead: 0.1,
        cacheWrite: 0.1,
        input: 0.3,
        output: 0.5,
      },
    };

    const result = mergeUsage(a, a);

    expect(result).toEqual({
      input: 1000,
      output: 400,
      cacheRead: 100,
      cacheWrite: 20,
      totalTokens: 1400,
      cost: {
        total: 2.0,
        cacheRead: 0.2,
        cacheWrite: 0.2,
        input: 0.6,
        output: 1.0,
      },
    });
  });

  it("does not mutate the input objects", () => {
    const a = {
      input: 500,
      output: 200,
      cacheRead: 50,
      cacheWrite: 10,
      totalTokens: 700,
      cost: {
        total: 1.0,
        cacheRead: 0.1,
        cacheWrite: 0.1,
        input: 0.3,
        output: 0.5,
      },
    };

    const saved = { ...a, cost: { ...a.cost } };

    mergeUsage(a, a);

    expect(a).toEqual(saved);
  });
});
