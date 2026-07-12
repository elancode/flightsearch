import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// itsadeal.ai front-end. Kept deliberately lightweight (React + TS only),
// mirroring the dependency-light spirit of the Python backend.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
