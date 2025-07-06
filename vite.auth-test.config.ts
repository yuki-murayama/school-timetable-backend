import { cloudflarePlugin } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflarePlugin({
      worker: {
        main: './auth-test-minimal.tsx',
        bindings: {
          AUTH0_DOMAIN: 'school-timetable.jp.auth0.com',
          AUTH0_AUDIENCE: 'https://api.school-timetable.app',
          AUTH0_CLIENT_ID: 'YmQjwwCNctZZpYm93DDVWUxAV5Hbpkja',
          NODE_ENV: 'development',
        },
      },
    }),
  ],
})
