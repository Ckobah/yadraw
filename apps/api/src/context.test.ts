import { describe, expect, it } from "vitest";
import { demoUserIds } from "@yadraw/shared";
import { getRequestContext } from "./context.js";

describe("request context", () => {
  it("reads an explicit user id from request headers", () => {
    expect(
      getRequestContext(
        {
          headers: {
            "x-yadraw-user-id": demoUserIds.editor
          }
        },
        {
          NODE_ENV: "production"
        }
      )
    ).toEqual({
      userId: demoUserIds.editor,
      source: "header"
    });
  });

  it("uses DEV_USER_ID outside production", () => {
    expect(
      getRequestContext(
        {
          headers: {}
        },
        {
          NODE_ENV: "development",
          DEV_USER_ID: demoUserIds.owner
        }
      )
    ).toEqual({
      userId: demoUserIds.owner,
      source: "dev"
    });
  });

  it("does not silently fall back to an owner user", () => {
    expect(
      getRequestContext(
        {
          headers: {}
        },
        {
          NODE_ENV: "production",
          DEV_USER_ID: demoUserIds.owner
        }
      )
    ).toBeNull();

    expect(
      getRequestContext(
        {
          headers: {
            "x-yadraw-user-id": "not-a-uuid"
          }
        },
        {
          NODE_ENV: "development"
        }
      )
    ).toBeNull();
  });
});
