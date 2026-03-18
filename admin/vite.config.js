import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    proxy: {
      '/api': {
        target: 'http://smspaisav2-env.eba-dvwrwwc7.ap-south-1.elasticbeanstalk.com',
        changeOrigin: true,
      }
    }
  }
})
