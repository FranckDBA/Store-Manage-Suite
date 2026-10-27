/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        ink: "#171717",
        muted: "#737373",
        line: "#E7E7E7",
        brand: "#2563EB",
        brandpale: "#EFF6FF",
        success: "#059669",
        successpale: "#ECFDF5",
        warn: "#D97706",
        warnpale: "#FFFBEB",
        danger: "#DC2626",
      },
    },
  },
  plugins: [],
};