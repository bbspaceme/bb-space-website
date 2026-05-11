import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(({ mode }) => {
  // Load environment variables based on mode
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      tanstackStart({ target: "node" }),
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
          manualChunks: {
            // Vendor chunks for better caching
            vendor: ["react", "react-dom"],
            router: ["@tanstack/react-router", "@tanstack/react-query"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
            supabase: ["@supabase/supabase-js"],
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
    },
  };
});
