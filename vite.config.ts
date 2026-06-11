import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const acordTemplateChecks = () => ({
  name: 'agencyiq-acord-template-check',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/acord/templates/check', (_req, res) => {
      const templates = [
        {
          formType: 'acord_125',
          templateFile: 'acord-125.pdf',
        },
      ]

      const checks = templates.map((template) => {
        const resolvedTemplatePath = path.resolve(process.cwd(), 'public', 'acord-templates', template.templateFile)
        const exists = fs.existsSync(resolvedTemplatePath)
        const fileBytes = exists ? fs.readFileSync(resolvedTemplatePath) : Buffer.alloc(0)
        const header = fileBytes.subarray(0, 5).toString('utf8')

        return {
          formType: template.formType,
          templateFile: template.templateFile,
          resolvedTemplatePath,
          exists,
          fileSize: exists ? fileBytes.byteLength : 0,
          first20Bytes: exists ? fileBytes.subarray(0, 20).toString('utf8') : '',
          validPdfHeader: header === '%PDF-',
        }
      })

      console.info('[ACORD templates check]', checks)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ templates: checks }, null, 2))
    })
  },
  closeBundle() {
    const distTemplateDir = path.resolve(process.cwd(), 'dist', 'acord-templates')
    if (!fs.existsSync(distTemplateDir)) return

    for (const entry of fs.readdirSync(distTemplateDir)) {
      if (!entry.toLowerCase().endsWith('.pdf')) continue
      const templatePath = path.join(distTemplateDir, entry)
      fs.rmSync(templatePath, { force: true })
      console.warn(`[AgencyIQ] Removed licensed ACORD template from production bundle: ${templatePath}`)
    }
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), acordTemplateChecks()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
