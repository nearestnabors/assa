import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Get the input file from environment variable
const inputFile = process.env.VITE_INPUT;

if (!inputFile) {
  throw new Error("VITE_INPUT environment variable is required");
}

// Extract name without extension for output directory
const baseName = inputFile.replace(".html", "");

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: `dist/ui/${baseName}`,
    emptyDirOnStart: true,
    rollupOptions: {
      input: resolve(__dirname, `ui-apps/${inputFile}`),
    },
  },
});
