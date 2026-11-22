import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { modelApi } from './server/modelApi.ts'
import { imageApi } from './server/imageApi.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), modelApi(), imageApi()],
})
