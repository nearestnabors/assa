import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Get the app name from environment variable (e.g., "auth-button", "conversation-list")
const appName = process.env.VITE_APP;

if (!appName) {
  throw new Error(
    "VITE_APP environment variable is required (e.g., 'auth-button')"
  );
}

export default defineConfig({
  root: resolve(__dirname, `ui-apps/${appName}`),
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(__dirname, `dist/ui/${appName}`),
    emptyDirOnStart: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./ui-apps"),
    },
  },
});
