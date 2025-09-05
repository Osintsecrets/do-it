import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import astroPWA from "@vite-pwa/astro";

const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  base,
  trailingSlash: "ignore",
  integrations: [
    tailwind(),
    react(),
    astroPWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-maskable.svg"],
      manifest: {
        name: "Portal",
        short_name: "Portal",
        description: "Neon-glass PWA with local diary, tools, and zero-backend encryption.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#070B12",
        theme_color: "#22d3ee",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        runtimeCaching: [
          { urlPattern: ({request}) => request.destination === "image", handler: "CacheFirst", options: { cacheName: "img", expiration: { maxEntries: 60, maxAgeSeconds: 60*60*24*30 } } },
          { urlPattern: ({url}) => url.origin === self.location.origin, handler: "StaleWhileRevalidate", options: { cacheName: "pages" } }
        ]
      },
      devOptions: { enabled: true }
    })
  ]
});
