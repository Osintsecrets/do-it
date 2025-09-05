/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 600: "#06b6d4" }
      },
      boxShadow: { soft: "0 10px 30px rgba(0,0,0,0.12)" },
      keyframes: { fadeInUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } } },
      animation: { fadeInUp: "fadeInUp 400ms ease-out both" }
    }
  },
  plugins: []
};
