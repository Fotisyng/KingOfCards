import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // App-shell caching only: data reads/writes stay online-first except review-rating
      // submission, which has its own offline queue (see docs/design-decisions.md).
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      manifest: {
        name: "KingOfCards",
        short_name: "KingOfCards",
        description: "Study flashcards with a spaced-repetition scheduler.",
        theme_color: "#5b2e8c",
        background_color: "#fdfaf5",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
