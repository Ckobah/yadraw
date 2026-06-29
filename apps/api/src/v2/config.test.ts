import { describe, expect, it } from "vitest";
import { validateV2RuntimeConfig } from "./config.js";

describe("validateV2RuntimeConfig", () => {
  it("allows v2-postgres in production", () => {
    expect(() =>
      validateV2RuntimeConfig("production", "v2-postgres"),
    ).not.toThrow();
  });

  it("allows memory in development", () => {
    expect(() =>
      validateV2RuntimeConfig("development", "memory"),
    ).not.toThrow();
  });

  it("allows undefined env (defaults to development guard behavior)", () => {
    expect(() =>
      validateV2RuntimeConfig(undefined, "v2-postgres"),
    ).not.toThrow();
  });

  it("allows undefined storage (defaults to v2-postgres)", () => {
    expect(() =>
      validateV2RuntimeConfig("production", undefined),
    ).not.toThrow();
  });

  it("throws on memory in production", () => {
    expect(() =>
      validateV2RuntimeConfig("production", "memory"),
    ).toThrow(
      "YADRAW_V2_STORAGE must be 'v2-postgres' in production",
    );
  });

  it("throws on unknown storage in production", () => {
    expect(() =>
      validateV2RuntimeConfig("production", "legacy-postgres"),
    ).toThrow(
      "YADRAW_V2_STORAGE must be 'v2-postgres' in production",
    );
  });
});
