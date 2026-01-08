import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Vite 会自动加载 .env 文件，以 VITE_ 开头的变量会暴露给客户端
    // 本地开发：从 .env.local 读取
    // 生产构建：从环境变量读取（GitHub Actions / Vercel）
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
