/**
 * Auth Button React App
 *
 * Handles OAuth flow and shows connection status.
 * Conversation display is handled by conversation-list app.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { useAuthPoller } from "@/hooks/use-auth-poller";
import { useMcpApp } from "@/hooks/use-mcp-app";
import { isAuthRequired } from "@/hooks/utils";

// Regex for extracting username from strings
const USERNAME_REGEX = /@(\w+)/;

interface AuthData {
  service: string;
  authUrl: string;
  state: string;
}

interface ConnectedData {
  username?: string;
  message?: string;
}

type AppState = "loading" | "auth-required" | "connected";

export function AuthButtonApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [username, setUsername] = useState<string>("");

  const { initialData, callTool, openLink } = useMcpApp<
    AuthData | ConnectedData | string
  >({
    name: "ASSA Auth",
    version: "1.0.0",
  });

  // Auth poller
  const authPoller = useAuthPoller({
    callTool,
    openLink,
    onAuthComplete: () => {
      // Refresh to show connected status
      setAppState("connected");
    },
  });

  // Handle initial data from tool result
  useEffect(() => {
    if (!initialData) {
      return;
    }

    // Handle string messages (e.g., "✓ X connected as @username...")
    if (typeof initialData === "string") {
      // Parse username from string if present
      const match = initialData.match(USERNAME_REGEX);
      if (match) {
        setUsername(match[1]);
      }
      setAppState("connected");
      return;
    }

    if (isAuthRequired(initialData)) {
      setAuthData(initialData);
      setAppState("auth-required");
    } else if (
      typeof initialData === "object" &&
      initialData !== null &&
      "username" in initialData
    ) {
      setUsername(initialData.username || "");
      setAppState("connected");
    }
  }, [initialData]);

  // Handle connect button click
  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  // Render loading state
  if (appState === "loading") {
    return (
      <div
        className="container flex flex-col items-center justify-center gap-4"
        style={{ padding: 40 }}
      >
        <div className="loading loading-lg" />
        <p className="text-muted">Checking connection...</p>
      </div>
    );
  }

  // Render auth required state
  if (appState === "auth-required") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <h2>Connect to X</h2>
        <p className="text-center text-muted">
          Connect your X account to view and respond to your mentions.
        </p>

        {authPoller.isPolling ? (
          <div className="flex flex-col items-center gap-2">
            <div className="loading" />
            <p className="text-muted">{authPoller.status}</p>
          </div>
        ) : (
          <Button onClick={handleConnect} size="lg" variant="primary">
            Connect {authData?.service || "X"}
          </Button>
        )}

        {authPoller.error && (
          <p className="text-muted" style={{ color: "var(--color-error)" }}>
            Error: {authPoller.error.message}
          </p>
        )}
      </div>
    );
  }

  // Render connected state
  return (
    <div className="container">
      <div className="flex flex-col items-center gap-4" style={{ padding: 40 }}>
        <div
          style={{
            fontSize: "3rem",
            marginBottom: 8,
          }}
        >
          ✓
        </div>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Connected to X</h2>
        {username && <p className="text-muted">Logged in as @{username}</p>}
      </div>
    </div>
  );
}
