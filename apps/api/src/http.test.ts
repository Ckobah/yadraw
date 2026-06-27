import { describe, expect, it } from "vitest";
import { errorBody } from "./http.js";

describe("HTTP error helpers", () => {
  it("formats API errors consistently", () => {
    expect(errorBody("forbidden", "Forbidden")).toEqual({
      error: {
        code: "forbidden",
        message: "Forbidden"
      }
    });
  });

  it("includes validation fields when provided", () => {
    expect(errorBody("invalid_payload", "Invalid payload", { title: ["Required"] })).toEqual({
      error: {
        code: "invalid_payload",
        message: "Invalid payload",
        fields: {
          title: ["Required"]
        }
      }
    });
  });
});
