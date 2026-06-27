import { describe, expect, it } from "vitest";
import { validateV2RuntimeConfig } from "./config.js";

describe("validateV2RuntimeConfig", () => {
  it("allows v2-postgres in production", () => {
    expect(() =>
      validateV2RuntimeConfig("production", "v2-postgres"),
    ).not.toThrow();
  });

  it("throws on legacy-postgres in production", () => {
    expect(() =>
      validateV2RuntimeConfig("production", "legacy-postgres"),
    ).toThrow(
      "YADRAW_V2_STORAGE=legacy-postgres is migration-only and is not allowed in production",
    );
  });

  it("allows legacy-postgres in development", () => {
    expect(() =>
      validateV2RuntimeConfig("development", "legacy-postgres"),
    ).not.toThrow();
  });

  it("allows legacy-postgres in test", () => {
    expect(() => validateV2RuntimeConfig("test", "legacy-postgres")).not.toThrow();
  });

  it("allows memory in development", () => {
    expect(() =>
      validateV2RuntimeConfig("development", "memory"),
    ).not.toThrow();
  });

  it("allows undefined env (defaults to development guard behavior)", () => {
    expect(() =>
      validateV2RuntimeConfig(undefined, "legacy-postgres"),
    ).not.toThrow();
  });

  it("allows undefined storage (defaults to v2-postgres)", () => {
    expect(() =>
      validateV2RuntimeConfig("production", undefined),
    ).not.toThrow();
  });
});
