/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./pages/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#432C69  ",
        secondary: "#F0D392",
        accent: "#B88279",
        dark: "#513CD6",
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body: ["Nunito", "sans-serif"],
        ui: ["Quicksand", "sans-serif"],
      },
    },
  },
  plugins: [],
};
