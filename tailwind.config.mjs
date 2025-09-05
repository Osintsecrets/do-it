/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"]
      },
      colors: {
        base: "#070B12",
        glass: "rgba(17, 24, 39, 0.55)",
        neon: {
          cyan: "#22d3ee",
          pink: "#fb7185",
          purple: "#a78bfa"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.25)",
        glow: "0 0 40px rgba(34, 211, 238, 0.35)"
      },
      backdropBlur: {
        xs: "2px"
      },
      keyframes: {
        floaty: { "0%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" }, "100%": { transform: "translateY(0)" } },
        fadeUp: { "0%": { opacity: 0, transform: "translateY(12px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        pulseGlow: { "0%": { boxShadow: "0 0 0 rgba(34,211,238,0)" }, "50%": { boxShadow: "0 0 40px rgba(34,211,238,.35)" }, "100%": { boxShadow: "0 0 0 rgba(34,211,238,0)" } }
      },
      animation: {
        floaty: "floaty 8s ease-in-out infinite",
        fadeUp: "fadeUp .5s ease-out both",
        pulseGlow: "pulseGlow 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
