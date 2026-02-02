/**
 * Auth Button React App
 *
 * Handles OAuth flow and shows connection status.
 */

import { useEffect, useState } from "react";
import { type AppState, StateContainer } from "@/components/state-container";
import { useAuthPoller } from "@/hooks/use-auth-poller";
import { useMcpApp } from "@/hooks/use-mcp-app";
import { type AuthRequiredResponse, isAuthRequired } from "@/hooks/utils";

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

export function AuthButtonApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [authData, setAuthData] = useState<AuthRequiredResponse | null>(null);
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
    onAuthComplete: () => setAppState("success"),
  });

  // Handle initial data from tool result
  useEffect(() => {
    if (!initialData) {
      return;
    }

    // Handle string messages (e.g., "✓ X connected as @username...")
    if (typeof initialData === "string") {
      const match = initialData.match(USERNAME_REGEX);
      if (match) {
        setUsername(match[1]);
      }
      setAppState("success");
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
      setAppState("success");
    }
  }, [initialData]);

  // Handle connect button click
  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  // Connected state content (rendered when state is "success")
  const ConnectedView = () => (
    <div className="container flex flex-col items-center gap-4 p-40">
      <div className="icon-xl">✓</div>
      <h2 className="heading-flush">Connected to X</h2>
      {username && <p className="text-muted">Logged in as @{username}</p>}
    </div>
  );

  // For auth-button, "success" means "connected" so we render custom content
  if (appState === "success") {
    return <ConnectedView />;
  }

  return (
    <StateContainer
      authData={authData}
      authDescription="Connect your X account to view and respond to your mentions."
      authPoller={authPoller}
      loadingMessage="Checking connection..."
      onConnect={handleConnect}
      state={appState}
    />
  );
}
