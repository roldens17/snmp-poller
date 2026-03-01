/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                midnight: {
                    bg: '#0D1117',
                    card: '#161B22',
                    border: '#30363D',
                    accent: '#2F81F7',
                    text: {
                        primary: '#E6EDF3',
                        secondary: '#8B949E',
                    },
                    status: {
                        critical: '#F85149',
                        high: '#FF7B72',
                        warning: '#D29922',
                        success: '#3FB950',
                    },
                },
                rich: {
                    black: '#0f172a',
                    gray: '#111827',
                    dark: '#1f2937',
                },
                gold: {
                    DEFAULT: '#3b82f6',
                    light: '#93c5fd',
                    dark: '#1d4ed8',
                    dim: '#1e3a8a',
                }
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'], // Modern, premium feel
            },
            boxShadow: {
                'gold': '0 4px 14px 0 rgba(59, 130, 246, 0.35)',
                'gold-glow': '0 0 15px rgba(59, 130, 246, 0.5)',
            }
        },
    },
    plugins: [],
}
