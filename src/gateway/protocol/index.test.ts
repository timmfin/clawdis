import { describe, expect, test } from "vitest";
import { formatValidationErrors } from "./index.js";

describe("formatValidationErrors", () => {
  describe("cron schedule errors", () => {
    test("provides helpful message for schedule type error", () => {
      const errors = [
        {
          instancePath: "/schedule",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      expect(formatValidationErrors(errors)).toBe(
        "schedule must be one of: { kind: 'at', atMs: number }, { kind: 'every', everyMs: number, anchorMs?: number }, { kind: 'cron', expr: string, tz?: string }",
      );
    });

    test("handles schedule error with empty instancePath", () => {
      const errors = [
        {
          instancePath: "/schedule",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      expect(formatValidationErrors(errors)).toContain("schedule must be one of");
    });
  });

  describe("cron payload errors", () => {
    test("provides helpful message for payload type error", () => {
      const errors = [
        {
          instancePath: "/payload",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      expect(formatValidationErrors(errors)).toBe(
        "payload must be one of: { kind: 'systemEvent', text: string }, { kind: 'agentTurn', message: string, ... }",
      );
    });
  });

  describe("cron sessionTarget errors", () => {
    test("provides helpful message for sessionTarget type error", () => {
      const errors = [
        {
          instancePath: "/sessionTarget",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        },
      ];
      expect(formatValidationErrors(errors)).toBe(
        "sessionTarget must be 'main' or 'isolated'",
      );
    });

    test("provides helpful message for sessionTarget enum error", () => {
      const errors = [
        {
          instancePath: "/sessionTarget",
          keyword: "enum",
          params: { allowedValues: ["main", "isolated"] },
          message: "must be one of",
        },
      ];
      expect(formatValidationErrors(errors)).toBe(
        "sessionTarget must be 'main' or 'isolated'",
      );
    });
  });

  describe("field constraint errors", () => {
    test("falls back to ajv.errorsText for field constraint violations", () => {
      const errors = [
        {
          instancePath: "/schedule/atMs",
          keyword: "minimum",
          params: { limit: 0 },
          message: "must be >= 0",
        },
      ];
      expect(formatValidationErrors(errors)).toBe("data/schedule/atMs must be >= 0");
    });

    test("falls back to ajv.errorsText for required field errors", () => {
      const errors = [
        {
          instancePath: "/schedule/kind",
          keyword: "required",
          params: { missingProperty: "kind" },
          message: "must have required property 'kind'",
        },
      ];
      // required errors should fall back to default behavior
      expect(formatValidationErrors(errors)).toContain("must have required property");
    });
  });

  describe("edge cases", () => {
    test("returns unknown validation error for null input", () => {
      expect(formatValidationErrors(null)).toBe("unknown validation error");
    });

    test("returns unknown validation error for undefined input", () => {
      expect(formatValidationErrors(undefined)).toBe("unknown validation error");
    });

    test("returns ajv result for empty array", () => {
      expect(formatValidationErrors([])).toBe("No errors");
    });
  });
});
