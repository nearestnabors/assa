/**
 * React hook for MCP Apps SDK integration
 *
 * Wraps the @modelcontextprotocol/ext-apps App class
 * and provides React-friendly state management.
 */

import { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useRef, useState } from "react";

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

interface UseMcpAppOptions {
  name: string;
  version: string;
  autoResize?: boolean;
}

interface UseMcpAppReturn<T> {
  /** The MCP App instance (null until connected) */
  app: App | null;
  /** Initial data from the tool result */
  initialData: T | null;
  /** Whether the app is connected */
  isConnected: boolean;
  /** Call a server tool */
  callTool: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<ToolResult>;
  /** Open an external link */
  openLink: (url: string) => Promise<void>;
  /** Update model context */
  updateContext: (text: string) => Promise<void>;
  /** Send a prompt to the model */
  sendPrompt: (prompt: string) => Promise<void>;
  /** Parse the text content from a tool result */
  parseResult: <R>(result: ToolResult) => R | null;
}

/**
 * Hook to integrate with MCP Apps SDK
 *
 * @example
 * ```tsx
 * const { app, initialData, callTool } = useMcpApp<ConversationsData>({
 *   name: "My App",
 *   version: "1.0.0",
 * });
 *
 * // Call a tool
 * const result = await callTool("x_get_conversations");
 * ```
 */
export function useMcpApp<T = unknown>(
  options: UseMcpAppOptions
): UseMcpAppReturn<T> {
  const appRef = useRef<App | null>(null);
  const [initialData, setInitialData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Parse text content from a tool result
  const parseResult = useCallback(<R>(result: ToolResult): R | null => {
    const textContent = result.content?.find((c) => c.type === "text");
    if (textContent && "text" in textContent) {
      try {
        return JSON.parse(textContent.text as string) as R;
      } catch {
        return textContent.text as unknown as R;
      }
    }
    return null;
  }, []);

  // Initialize app on mount
  useEffect(() => {
    const app = new App(
      { name: options.name, version: options.version },
      {},
      { autoResize: options.autoResize ?? true }
    );

    // Handle initial tool result
    app.ontoolresult = (result: ToolResult) => {
      const data = parseResult<T>(result);
      if (data !== null) {
        setInitialData(data);
      }
    };

    app.connect();
    appRef.current = app;
    setIsConnected(true);

    return () => {
      // Cleanup if needed
      appRef.current = null;
      setIsConnected(false);
    };
  }, [options.name, options.version, options.autoResize, parseResult]);

  // Call a server tool
  const callTool = useCallback(
    async (
      name: string,
      args: Record<string, unknown> = {}
    ): Promise<ToolResult> => {
      if (!appRef.current) {
        throw new Error("App not connected");
      }
      return await appRef.current.callServerTool({ name, arguments: args });
    },
    []
  );

  // Open an external link
  const openLink = useCallback(async (url: string): Promise<void> => {
    if (!appRef.current) {
      throw new Error("App not connected");
    }
    await appRef.current.openLink({ url });
  }, []);

  // Update model context
  const updateContext = useCallback(async (text: string): Promise<void> => {
    if (!appRef.current) {
      throw new Error("App not connected");
    }
    await appRef.current.updateModelContext({
      content: [{ type: "text", text }],
    });
  }, []);

  // Send a prompt to the model
  const sendPrompt = useCallback(async (prompt: string): Promise<void> => {
    if (!appRef.current) {
      throw new Error("App not connected");
    }
    await appRef.current.sendPrompt({ prompt });
  }, []);

  return {
    app: appRef.current,
    initialData,
    isConnected,
    callTool,
    openLink,
    updateContext,
    sendPrompt,
    parseResult,
  };
}
