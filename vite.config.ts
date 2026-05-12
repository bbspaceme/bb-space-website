import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), "");
  const target = process.env.DEPLOY_TARGET === "cloudflare" ? "cloudflare" : "node";

  return {
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      tanstackStart({ target }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],

    // Environment-specific configurations
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || mode),
      __SENTRY_ENV__: JSON.stringify(env.SENTRY_ENVIRONMENT || mode),
    },

    // Build optimizations
    build: {
      sourcemap: mode === "development" || mode === "staging",
      minify: mode === "production",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
                return "router";
              }
              if (
                id.includes("@radix-ui/react-dialog") ||
                id.includes("@radix-ui/react-dropdown-menu") ||
                id.includes("lucide-react")
              ) {
                return "ui";
              }
              if (id.includes("@supabase/supabase-js")) {
                return "supabase";
              }
              if (id.includes("recharts")) {
                return "charts";
              }
              if (id.includes("jspdf") || id.includes("jspdf-autotable")) {
                return "pdf";
              }
              if (id.includes("xlsx")) {
                return "excel";
              }
              if (id.includes("otpauth") || id.includes("qrcode")) {
                return "crypto";
              }
              if (id.includes("react") || id.includes("react-dom")) {
                return "vendor";
              }
            }
          },
        },
      },
    },

    // Development server configuration
    server: {
      host: true,
      port: 3000,
    },

    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      exclude: ["e2e/**"],
    },
  };
});
