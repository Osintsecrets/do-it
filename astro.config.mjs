import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import astroPWA from "@vite-pwa/astro";

export default defineConfig({
  trailingSlash: "ignore",
  integrations: [
    tailwind(),
    react(),
    astroPWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-maskable.svg"],
      manifest: {
        name: "Portal PWA",
        short_name: "Portal",
        description: "Offline-capable portal with a local diary.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#0ea5e9",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"]
      },
      devOptions: { enabled: true }
    })
  ]
});
