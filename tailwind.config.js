/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind scans these for class names as LITERAL TEXT. Class names are therefore written whole
  // in the .ts files that build the UI — never assembled from fragments (`bg-${c}-600`), which
  // compiles fine and then silently ships without the style.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
