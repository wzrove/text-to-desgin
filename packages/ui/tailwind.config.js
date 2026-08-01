import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        textdesign: {
          primary: '#8AD654',
          'primary-content': '#1a2b0e',
          secondary: '#333333',
          'secondary-content': '#ffffff',
          accent: '#F76868',
          'accent-content': '#ffffff',
          neutral: '#2a2a2a',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#f5f7f2',
          'base-300': '#e9eee2',
          'base-content': '#333333',
          info: '#6bb8f7',
          'info-content': '#ffffff',
          success: '#8AD654',
          'success-content': '#1a2b0e',
          warning: '#f7b955',
          'warning-content': '#3a2e00',
          error: '#F76868',
          'error-content': '#ffffff',
        },
      },
    ],
  },
};
