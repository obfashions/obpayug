// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      alias: [
        { find: "entities/lib/decode.js", replacement: fileURLToPath(new URL("./node_modules/entities/lib/esm/decode.js", import.meta.url)) },
        { find: "entities/lib/encode.js", replacement: fileURLToPath(new URL("./node_modules/entities/lib/esm/encode.js", import.meta.url)) },
        { find: "entities/escape", replacement: fileURLToPath(new URL("./node_modules/entities/lib/esm/escape.js", import.meta.url)) },
        { find: "entities/decode", replacement: fileURLToPath(new URL("./node_modules/entities/lib/esm/decode.js", import.meta.url)) },
        { find: /^entities$/, replacement: fileURLToPath(new URL("./node_modules/entities/lib/esm/index.js", import.meta.url)) },
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
