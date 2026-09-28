import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://scvdsajwsuzstagjjltg.supabase.co';
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRzYWp3c3V6c3RhZ2pqbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjAzODcsImV4cCI6MjA4MjczNjM4N30._JbsT7W4NRESXqVggSE_Ahel6aXYOymPk9zlzYiMGGU';

    return {
      clearScreen: false,
      server: {
        port: 3000,
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
          // TokenRouter blocks browser CORS, so tunnel it through the dev server.
          '/tokenrouter': {
            target: 'https://api.tokenrouter.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/tokenrouter/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.OPENROUTER_API_KEY': JSON.stringify(env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || ''),
        'process.env.TOKENROUTER_API_KEY': JSON.stringify(env.VITE_TOKENROUTER_API_KEY || env.TOKENROUTER_API_KEY || ''),
        'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
        'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
