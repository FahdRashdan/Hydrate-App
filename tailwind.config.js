/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2FB6D4",
          light: "#E6F6FB",
          dark: "#2394AD",
        },
        navy: {
          DEFAULT: "#0B3477",
          dark: "#082554",
          light: "#164B9A",
        },
        sky: "#F0F9FD",
        charcoal: "#1F2223",
      },
    },
  },
  plugins: [],
}
