/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: {
    relative: true,
    files: [
      "./app/**/*.{js,jsx,ts,tsx}",
      "./components/**/*.{js,jsx,ts,tsx}",
    ],
  },
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#D32F2F',
          50: '#FFEBEE',
          100: '#FFCDD2',
          200: '#EF9A9A',
          300: '#E57373',
          400: '#EF5350',
          500: '#D32F2F',
          600: '#C62828',
          700: '#B71C1C',
          800: '#9A0007',
          900: '#7F0000',
        },
        accent: {
          DEFAULT: '#121212',
        },
        surface: '#F8F8F8',
        verified: '#2E7D32',
        bookmark: '#FFB300',
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'Poppins-Regular', 'system-ui', 'sans-serif'],
        heading: ['Poppins-Bold', 'Poppins', 'sans-serif'],
        light: ['Poppins-Light', 'sans-serif'],
        normal: ['Poppins-Regular', 'sans-serif'],
        medium: ['Poppins-Medium', 'sans-serif'],
        semibold: ['Poppins-SemiBold', 'sans-serif'],
        bold: ['Poppins-Bold', 'sans-serif'],
        extrabold: ['Poppins-ExtraBold', 'sans-serif'],
        black: ['Poppins-Black', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};

