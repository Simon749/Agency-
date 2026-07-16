import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@db': path.resolve(__dirname, './db'),
      '@/db': path.resolve(__dirname, './db'),
      '@lib': path.resolve(__dirname, './lib'),
      '@/lib': path.resolve(__dirname, './lib'),
    },
  },
});