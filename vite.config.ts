import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    tanstackStart({ target: "node" }), // ← Node.js target for Vercel, not Cloudflare
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Only apply manualChunks for client build, not SSR
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor";
            }
            if (id.includes("@tanstack/react-router")) {
              return "router";
            }
            if (id.includes("@radix-ui")) {
              return "ui";
            }
          }
        },
      },
    },
  },
});
