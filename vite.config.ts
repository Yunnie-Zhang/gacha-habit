import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' 使构建产物可直接部署到 GitHub Pages 子路径或本地打开
export default defineConfig({
  plugins: [react()],
  base: './',
});
