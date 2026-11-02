/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'] },
      colors: {
        // SociYo plum (dark end) with lavender tints (light end)
        brand: {
          50: '#F6F2FB', 100: '#ECE4F7', 200: '#D6C8F0', 300: '#B49BD3', 400: '#8A6A9C',
          500: '#6A4669', 600: '#55344F', 700: '#472A45', 800: '#3B1F3A', 900: '#2A1529'
        },
        coral: { 50: '#FDF1ED', 100: '#FBDDD3', 400: '#EF8569', 500: '#E8674A', 600: '#C9502F', 700: '#B04A30' },
        accent: { 50: '#ECFDF3', 100: '#D1FADF', 400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
        ink: { 900: '#0F172A', 700: '#334155', 500: '#64748B', 400: '#94A3B8', 300: '#CBD5E1', 200: '#E2E8F0', 100: '#F1F5F9' },
        canvas: '#F8F4EF'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06)',
        float: '0 8px 30px rgba(59,31,58,.28)'
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '80%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: 1 } }
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in .2s ease-out',
        pop: 'pop .35s ease-out'
      }
    }
  },
  plugins: []
}
