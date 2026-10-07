import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Le port Vite doit être un entier entre 1 et 65535.');
  }
  return port;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: env.VITE_DEV_HOST ?? '127.0.0.1',
      port: readPort(env.VITE_DEV_PORT, 5174),
      strictPort: true,
    },
    preview: {
      host: env.VITE_DEV_HOST ?? '127.0.0.1',
      port: readPort(env.VITE_PREVIEW_PORT, 4174),
      strictPort: true,
    },
  };
});
