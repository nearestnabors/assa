/**
 * StateContainer - Shared UI states for MCP Apps
 *
 * Handles loading, auth-required, error, and success states
 * so individual apps only need to render their "loaded" content.
 */

import type { ReactNode } from "react";
import { Button } from "@/components/button";

export type AppState =
  | "loading"
  | "auth-required"
  | "error"
  | "success"
  | "loaded";

interface AuthPollerState {
  isPolling: boolean;
  status: string;
  error: Error | null;
}

interface StateContainerProps {
  state: AppState;

  // Loading state
  loadingMessage?: string;

  // Auth state
  authData?: { service: string; authUrl: string } | null;
  authPoller?: AuthPollerState;
  onConnect?: () => void;
  authDescription?: string;

  // Error state
  errorMessage?: string;
  errorIcon?: string;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
  retryLabel?: string;

  // Success state
  successIcon?: string;
  successTitle?: string;
  successMessage?: string;

  // Loaded state content
  children?: ReactNode;
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="container flex flex-col items-center justify-center gap-4 p-40">
      <div className="loading loading-lg" />
      <p className="text-muted">{message}</p>
    </div>
  );
}

function AuthRequiredState({
  authData,
  authPoller,
  onConnect,
  description,
}: {
  authData?: { service: string; authUrl: string } | null;
  authPoller?: AuthPollerState;
  onConnect?: () => void;
  description?: string;
}) {
  return (
    <div className="container flex flex-col items-center gap-4 p-40">
      <h2 className="heading-flush">Connect to X</h2>
      <p className="text-center text-muted">
        {description || "Connect your X account to continue."}
      </p>

      {authPoller?.isPolling ? (
        <div className="flex flex-col items-center gap-2">
          <div className="loading" />
          <p className="text-muted">{authPoller.status}</p>
        </div>
      ) : (
        <Button onClick={onConnect} size="lg" variant="primary">
          Connect {authData?.service || "X"}
        </Button>
      )}

      {authPoller?.error && (
        <p className="text-error">Error: {authPoller.error.message}</p>
      )}
    </div>
  );
}

function ErrorState({
  icon = "✕",
  title = "Something went wrong",
  message,
  onRetry,
  onBack,
  backLabel = "Back",
  retryLabel = "Try Again",
}: {
  icon?: string;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
  retryLabel?: string;
}) {
  return (
    <div className="container flex flex-col items-center gap-4 p-40">
      <div className="icon-xl">{icon}</div>
      <h2 className="heading-flush text-error">{title}</h2>
      {message && <p className="text-muted">{message}</p>}
      {(onBack || onRetry) && (
        <div className="button-group">
          {onBack && (
            <Button onClick={onBack} variant="secondary">
              {backLabel}
            </Button>
          )}
          {onRetry && (
            <Button onClick={onRetry} variant="primary">
              {retryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SuccessState({
  icon = "✓",
  title = "Success!",
  message,
}: {
  icon?: string;
  title?: string;
  message?: string;
}) {
  return (
    <div className="container flex flex-col items-center gap-4 p-40">
      <div className="icon-xl">{icon}</div>
      <h2 className="heading-flush text-success">{title}</h2>
      {message && <p className="text-muted">{message}</p>}
    </div>
  );
}

export function StateContainer({
  state,
  loadingMessage = "Loading...",
  authData,
  authPoller,
  onConnect,
  authDescription,
  errorMessage,
  errorIcon,
  onRetry,
  onBack,
  backLabel,
  retryLabel,
  successIcon,
  successTitle,
  successMessage,
  children,
}: StateContainerProps) {
  switch (state) {
    case "loading":
      return <LoadingState message={loadingMessage} />;

    case "auth-required":
      return (
        <AuthRequiredState
          authData={authData}
          authPoller={authPoller}
          description={authDescription}
          onConnect={onConnect}
        />
      );

    case "error":
      return (
        <ErrorState
          backLabel={backLabel}
          icon={errorIcon}
          message={errorMessage}
          onBack={onBack}
          onRetry={onRetry}
          retryLabel={retryLabel}
        />
      );

    case "success":
      return (
        <SuccessState
          icon={successIcon}
          message={successMessage}
          title={successTitle}
        />
      );

    default:
      return <>{children}</>;
  }
}
