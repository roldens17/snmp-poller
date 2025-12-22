/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // "Taste of Gold" Palette
                rich: {
                    black: '#0a0a0a', // Deepest black
                    gray: '#171717',  // Slightly lighter for cards
                    dark: '#262626',  // Borders/Separators
                },
                gold: {
                    DEFAULT: '#D4AF37', // Metallic Gold
                    light: '#F4CF55',   // Highlight
                    dark: '#AA8C2C',    // Shadow/Depth
                    dim: '#4f4215',     // Background tints
                }
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'], // Modern, premium feel
            },
            boxShadow: {
                'gold': '0 4px 14px 0 rgba(212, 175, 55, 0.3)',
                'gold-glow': '0 0 15px rgba(212, 175, 55, 0.5)',
            }
        },
    },
    plugins: [],
}
