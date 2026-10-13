import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Only `vite dev` loads the local-only entry and the checkout's dev key; a build
// keeps src/server.ts and never sees either (rer build checks its output).
const local = (name: string) => process.env[name] ? { [name]: process.env[name] } : {}
const assets = { binding: 'ASSETS', run_worker_first: true }
const serve = { assets, main: './src/server.dev.ts', vars: { ...local('RER_DEV_ORIGIN'), ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY') } }

// `vite dev` serves only the folders the app is built from (and what they
// import), never the rest of the checkout: not rer's private folders (the dev
// key, installer state), export archives, settings or local data.
const server = { fs: { allow: ['src', 'public', 'node_modules'], deny: ['**/.rer/**', '**/.seed/**', '**/exports/**', '**/*.rer'] } }

export default defineConfig(({ command, isPreview }) => ({ server, plugins: [cloudflare({ inspectorPort: false, viteEnvironment: { name: 'ssr' }, persistState: { path: '.wrangler/state' }, ...(command === 'serve' && !isPreview ? { config: serve } : process.env.RER_DEV_ORIGIN ? { config: { assets, vars: local('RER_DEV_ORIGIN') } } : { config: { assets } }) }), tanstackStart(), react()] }))
