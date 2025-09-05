import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This makes Vercel environment variables available in the app
  define: {
    'process.env.VITE_FAA_CLIENT_ID': `"${process.env.VITE_FAA_CLIENT_ID}"`,
    'process.env.VITE_FAA_CLIENT_SECRET': `"${process.env.VITE_FAA_CLIENT_SECRET}"`,
    'process.env.VITE_GROQ_API_KEY': `"${process.env.VITE_GROQ_API_KEY}"`,
  },
});
