import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Version del algoritmo: se imprime en cada reporte PDF para que un resultado
  // exportado sea trazable a la version exacta que lo genero.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
