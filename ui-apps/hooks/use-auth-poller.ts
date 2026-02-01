/**
 * React hook for OAuth polling
 *
 * Provides automatic polling for OAuth completion status.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAuthPollerOptions {
  /** Function to call a server tool */
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  /** Function to open an external link */
  openLink: (url: string) => Promise<void>;
  /** Called when auth completes successfully */
  onAuthComplete: () => Promise<void>;
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Auth status tool name (default: 'x_auth_status') */
  authStatusTool?: string;
}

interface UseAuthPollerReturn {
  /** Current status message */
  status: string;
  /** Whether currently polling */
  isPolling: boolean;
  /** Error if any */
  error: Error | null;
  /** Start OAuth flow - opens URL and begins polling */
  startAuth: (authUrl: string) => Promise<void>;
  /** Check auth status once (useful on initial load) */
  checkAuthStatus: () => Promise<boolean>;
  /** Stop polling */
  stopPolling: () => void;
}

/**
 * Hook for OAuth polling
 *
 * @example
 * ```tsx
 * const { status, isPolling, startAuth } = useAuthPoller({
 *   callTool,
 *   openLink,
 *   onAuthComplete: async () => {
 *     const conversations = await fetchConversations();
 *     setConversations(conversations);
 *   },
 * });
 *
 * return (
 *   <button onClick={() => startAuth(authUrl)} disabled={isPolling}>
 *     {isPolling ? status : "Connect X"}
 *   </button>
 * );
 * ```
 */
export function useAuthPoller(
  options: UseAuthPollerOptions
): UseAuthPollerReturn {
  const {
    callTool,
    openLink,
    onAuthComplete,
    pollInterval = 2000,
    authStatusTool = "x_auth_status",
  } = options;

  const [status, setStatus] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Check auth status
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await callTool(authStatusTool);

      // Parse result
      const textContent = (
        result as { content?: Array<{ type: string; text?: string }> }
      ).content?.find((c) => c.type === "text");

      if (textContent && "text" in textContent) {
        const text = textContent.text as string;
        if (text.includes("connected")) {
          stopPolling();
          setStatus("Loading...");
          await onAuthComplete();
          return true;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    }
    return false;
  }, [callTool, authStatusTool, onAuthComplete, stopPolling]);

  // Start auth flow
  const startAuth = useCallback(
    async (authUrl: string): Promise<void> => {
      try {
        setError(null);
        await openLink(authUrl);
        setStatus("Waiting for authorization...");
        setIsPolling(true);

        // Start polling
        stopPolling(); // Clear any existing interval
        intervalRef.current = window.setInterval(async () => {
          await checkAuthStatus();
        }, pollInterval);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [openLink, pollInterval, checkAuthStatus, stopPolling]
  );

  return {
    status,
    isPolling,
    error,
    startAuth,
    checkAuthStatus,
    stopPolling,
  };
}
