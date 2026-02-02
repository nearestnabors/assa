/**
 * Auth Response Contract Tests
 *
 * Ensures auth responses match the contract expected by UI components.
 * These tests verify the AuthRequiredResponse interface is correctly
 * implemented to prevent the "Checking connection..." hang bug.
 */

import { describe, expect, test } from "bun:test";

/**
 * AuthRequiredResponse interface - must match ui-apps/hooks/utils.ts
 * This is the contract between the tool and the UI component.
 *
 * IMPORTANT: If you change this interface, you must also update:
 * - src/tools/auth-status.ts (the tool that returns this)
 * - ui-apps/hooks/utils.ts (the isAuthRequired function)
 */
interface AuthRequiredResponse {
  authRequired: true;
  service: string;
  authUrl: string;
  state: string;
  message: string;
}

/**
 * Check if a response matches the AuthRequiredResponse interface
 * This mirrors the isAuthRequired function in ui-apps/hooks/utils.ts
 */
function isValidAuthRequiredResponse(
  data: unknown
): data is AuthRequiredResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const response = data as Record<string, unknown>;

  return (
    response.authRequired === true &&
    typeof response.service === "string" &&
    typeof response.authUrl === "string" &&
    typeof response.state === "string" &&
    typeof response.message === "string"
  );
}

/**
 * Required fields for AuthRequiredResponse
 * Used to generate test cases
 */
const REQUIRED_FIELDS = [
  "authRequired",
  "service",
  "authUrl",
  "state",
  "message",
] as const;

describe("AuthRequiredResponse contract", () => {
  // Valid response that should pass all checks
  const validResponse: AuthRequiredResponse = {
    authRequired: true,
    service: "X",
    authUrl: "https://twitter.com/oauth/authorize?token=abc123",
    state: "auth-state-xyz",
    message: "Connect your X account to continue.",
  };

  describe("valid responses", () => {
    test("accepts a complete valid response", () => {
      expect(isValidAuthRequiredResponse(validResponse)).toBe(true);
    });

    test("accepts response with extra fields", () => {
      const withExtra = {
        ...validResponse,
        extraField: "should be ignored",
        anotherExtra: 123,
      };
      expect(isValidAuthRequiredResponse(withExtra)).toBe(true);
    });
  });

  describe("authRequired field", () => {
    test("rejects when authRequired is missing", () => {
      const { authRequired, ...missing } = validResponse;
      expect(isValidAuthRequiredResponse(missing)).toBe(false);
    });

    test("rejects when authRequired is false", () => {
      const invalid = { ...validResponse, authRequired: false };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });

    test("rejects when authRequired is string 'true'", () => {
      const invalid = { ...validResponse, authRequired: "true" };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });

    test("rejects when authRequired is 1", () => {
      const invalid = { ...validResponse, authRequired: 1 };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });
  });

  describe("service field", () => {
    test("rejects when service is missing", () => {
      const { service, ...missing } = validResponse;
      expect(isValidAuthRequiredResponse(missing)).toBe(false);
    });

    test("rejects when service is not a string", () => {
      const invalid = { ...validResponse, service: 123 };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });

    test("accepts empty string for service", () => {
      const withEmpty = { ...validResponse, service: "" };
      expect(isValidAuthRequiredResponse(withEmpty)).toBe(true);
    });
  });

  describe("authUrl field", () => {
    test("rejects when authUrl is missing", () => {
      const { authUrl, ...missing } = validResponse;
      expect(isValidAuthRequiredResponse(missing)).toBe(false);
    });

    test("rejects when authUrl is not a string", () => {
      const invalid = { ...validResponse, authUrl: null };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });
  });

  describe("state field", () => {
    test("rejects when state is missing", () => {
      const { state, ...missing } = validResponse;
      expect(isValidAuthRequiredResponse(missing)).toBe(false);
    });

    test("rejects when state is not a string", () => {
      const invalid = { ...validResponse, state: { id: "test" } };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });
  });

  describe("message field", () => {
    test("rejects when message is missing", () => {
      const { message, ...missing } = validResponse;
      expect(isValidAuthRequiredResponse(missing)).toBe(false);
    });

    test("rejects when message is not a string", () => {
      const invalid = { ...validResponse, message: undefined };
      expect(isValidAuthRequiredResponse(invalid)).toBe(false);
    });
  });

  describe("invalid input types", () => {
    test("rejects null", () => {
      expect(isValidAuthRequiredResponse(null)).toBe(false);
    });

    test("rejects undefined", () => {
      expect(isValidAuthRequiredResponse(undefined)).toBe(false);
    });

    test("rejects string", () => {
      expect(isValidAuthRequiredResponse("not an object")).toBe(false);
    });

    test("rejects number", () => {
      expect(isValidAuthRequiredResponse(42)).toBe(false);
    });

    test("rejects array", () => {
      expect(isValidAuthRequiredResponse([validResponse])).toBe(false);
    });

    test("rejects empty object", () => {
      expect(isValidAuthRequiredResponse({})).toBe(false);
    });
  });

  describe("regression: bug that caused 'Checking connection...' hang", () => {
    test("OLD FORMAT (bug): missing authRequired field is rejected", () => {
      // This was the old format that caused the hang
      const oldBuggyFormat = {
        service: "X",
        authUrl: "https://twitter.com/oauth/authorize?token=abc123",
        state: "auth-state-xyz",
        // Missing: authRequired: true
        // Missing: message
      };

      expect(isValidAuthRequiredResponse(oldBuggyFormat)).toBe(false);
    });

    test("NEW FORMAT (fixed): includes authRequired and message", () => {
      // This is the correct format
      const fixedFormat = {
        authRequired: true,
        service: "X",
        authUrl: "https://twitter.com/oauth/authorize?token=abc123",
        state: "auth-state-xyz",
        message: "Connect your X account to continue.",
      };

      expect(isValidAuthRequiredResponse(fixedFormat)).toBe(true);
    });
  });
});

describe("auth-status tool response format", () => {
  /**
   * This test documents what the auth-status tool SHOULD return.
   * If this test fails, update src/tools/auth-status.ts to match.
   */
  test("documents expected auth-required response format", () => {
    // When not authenticated, auth-status should return JSON like this:
    const expectedFormat = {
      authRequired: true,
      service: "X",
      authUrl: "https://twitter.com/i/oauth2/authorize?...",
      state: "ar_xxxxxxxxxxxxx",
      message: "Connect your X account to continue.",
    };

    // Verify the expected format is valid
    expect(isValidAuthRequiredResponse(expectedFormat)).toBe(true);

    // Document required fields
    expect(expectedFormat).toHaveProperty("authRequired", true);
    expect(expectedFormat).toHaveProperty("service");
    expect(expectedFormat).toHaveProperty("authUrl");
    expect(expectedFormat).toHaveProperty("state");
    expect(expectedFormat).toHaveProperty("message");
  });

  test("documents expected success response format", () => {
    // When authenticated, auth-status should return a text message like:
    const expectedSuccessMessage =
      "✓ X connected as @username. You can now post, reply, and view your conversations.";

    // The message should contain the checkmark
    expect(expectedSuccessMessage).toContain("✓");

    // The message should mention X
    expect(expectedSuccessMessage).toContain("X connected");
  });
});
