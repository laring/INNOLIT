import {demoApi} from './demo/server.ts'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { modelApi } from './server/modelApi.ts'
import { imageApi } from './server/imageApi.ts'

// https://vite.dev/config/
export default defineConfig(({mode})=>({
  server: mode==='demo'?{headers:{'Content-Security-Policy':"connect-src 'self' ws://127.0.0.1:5190"}}:undefined,
  plugins: [react(), ...(mode==='demo'?[demoApi()]:[modelApi(), imageApi()])],
}))
