import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// NOTE: The Gemini API key is intentionally NOT injected into the client
// bundle. All AI calls go through the serverless API routes in /api,
// which read GEMINI_API_KEY from the server environment only.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
