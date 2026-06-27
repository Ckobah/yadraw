import { describe, expect, it } from "vitest";
import { hasWorkspaceAccess } from "./authorization.js";

describe("workspace authorization", () => {
  it("allows all product roles to read workspace data", () => {
    expect(hasWorkspaceAccess("owner", "read")).toBe(true);
    expect(hasWorkspaceAccess("admin", "read")).toBe(true);
    expect(hasWorkspaceAccess("editor", "read")).toBe(true);
    expect(hasWorkspaceAccess("viewer", "read")).toBe(true);
    expect(hasWorkspaceAccess("service", "read")).toBe(true);
  });

  it("allows writes only for editor-level roles", () => {
    expect(hasWorkspaceAccess("owner", "write")).toBe(true);
    expect(hasWorkspaceAccess("admin", "write")).toBe(true);
    expect(hasWorkspaceAccess("editor", "write")).toBe(true);
    expect(hasWorkspaceAccess("service", "write")).toBe(true);
    expect(hasWorkspaceAccess("viewer", "write")).toBe(false);
    expect(hasWorkspaceAccess("guest", "write")).toBe(false);
    expect(hasWorkspaceAccess(null, "write")).toBe(false);
  });
});
