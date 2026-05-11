import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid picking a parent-folder lockfile when this repo lives under another npm project.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
