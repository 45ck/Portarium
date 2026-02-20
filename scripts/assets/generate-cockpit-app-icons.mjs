import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import YAML from 'yaml'

const repoRoot = process.cwd()
const promptCatalogPath = path.join(
  repoRoot,
  'docs',
  'assets',
  'prompts',
  'cockpit-brand-assets.yml',
)
const publicRoot = path.join(repoRoot, 'apps', 'cockpit', 'public')
const brandRoot = path.join(publicRoot, 'brand')

const fallbackEnvFiles = [
  'C:/Projects/MacquarieCollege/.env',
  'C:/Projects/content-machine/.env',
]

function parseArgs(argv) {
  const options = {
    promptId: 'CB-BRAND-01',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--prompt-id') {
      options.promptId = String(argv[index + 1] ?? 'CB-BRAND-01')
      index += 1
      continue
    }
  }

  return options
}

function parseDotEnv(raw) {
  const values = new Map()
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex <= 0) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^"(.*)"$/u, '$1')
    values.set(key, value)
  }
  return values
}

async function loadGeminiApiKey() {
  const envValue = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (envValue) return envValue

  for (const envFile of fallbackEnvFiles) {
    if (!existsSync(envFile)) continue
    const raw = await readFile(envFile, 'utf8')
    const parsed = parseDotEnv(raw)
    const candidate =
      parsed.get('GEMINI_API_KEY') ??
      parsed.get('GOOGLE_API_KEY') ??
      parsed.get('GOOGLE_GENAI_API_KEY')
    if (candidate) return candidate
  }

  return undefined
}

async function generateMasterPng({ apiKey, promptText }) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent'
  const response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '2K',
        },
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      `Gemini API ${response.status}: ${JSON.stringify(payload?.error ?? payload).slice(0, 400)}`,
    )
  }

  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini response did not include content parts')
  }

  const imagePart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  )
  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data
  if (!inlineData?.data) {
    throw new Error('Gemini response did not include inline image data')
  }

  return Buffer.from(inlineData.data, 'base64')
}

function buildPrompt(prompt) {
  return [
    prompt,
    'Additional constraints: centered icon mark only, no text, crisp edges, white background with no texture.',
    'Keep composition balanced for downscaling to favicon sizes.',
  ].join('\n\n')
}

function createIcoFromPng(pngBuffer, width, height) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(width >= 256 ? 0 : width, 6)
  header.writeUInt8(height >= 256 ? 0 : height, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuffer.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, pngBuffer])
}

async function writeSquarePng(source, outputPath, size) {
  await sharp(source)
    .ensureAlpha()
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

async function writeMaskablePng(source, outputPath) {
  const innerSize = 384
  const margin = Math.floor((512 - innerSize) / 2)
  const inner = await sharp(source)
    .ensureAlpha()
    .resize(innerSize, innerSize, { fit: 'cover' })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: inner, left: margin, top: margin }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath)
}

function createFaviconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#12233f"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14b8a6"/>
      <stop offset="1" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <path d="M18 48V16h17c8 0 13 5 13 12 0 7-5 12-13 12h-8v8zM27 24v8h7c3 0 5-2 5-4 0-2-2-4-5-4z" fill="url(#mark)"/>
</svg>
`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const apiKey = await loadGeminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in env or fallback env files')
  }

  const rawCatalog = await readFile(promptCatalogPath, 'utf8')
  const parsedCatalog = YAML.parse(rawCatalog)
  const prompts = Array.isArray(parsedCatalog?.prompts) ? parsedCatalog.prompts : []
  const promptDef = prompts.find((prompt) => prompt.id === options.promptId)
  if (!promptDef?.prompt) {
    throw new Error(`Prompt ID ${options.promptId} not found in ${promptCatalogPath}`)
  }

  const promptText = buildPrompt(promptDef.prompt)
  console.log(`[cockpit:assets:app-icons] Generating master icon from ${options.promptId}`)
  const master = await generateMasterPng({ apiKey, promptText })

  await mkdir(brandRoot, { recursive: true })

  const sourcePath = path.join(brandRoot, 'app-icon-source.png')
  const favicon16Path = path.join(publicRoot, 'favicon-16x16.png')
  const favicon32Path = path.join(publicRoot, 'favicon-32x32.png')
  const faviconIcoPath = path.join(publicRoot, 'favicon.ico')
  const faviconSvgPath = path.join(publicRoot, 'favicon.svg')
  const appleTouchPath = path.join(publicRoot, 'apple-touch-icon.png')
  const icon192Path = path.join(publicRoot, 'icon-192.png')
  const icon512Path = path.join(publicRoot, 'icon-512.png')
  const iconMaskable512Path = path.join(publicRoot, 'icon-maskable-512.png')
  const webmanifestPath = path.join(publicRoot, 'site.webmanifest')
  const metadataPath = path.join(brandRoot, 'app-icon-metadata.json')

  await writeFile(sourcePath, master)
  await writeSquarePng(master, favicon16Path, 16)
  await writeSquarePng(master, favicon32Path, 32)
  await writeSquarePng(master, appleTouchPath, 180)
  await writeSquarePng(master, icon192Path, 192)
  await writeSquarePng(master, icon512Path, 512)
  await writeMaskablePng(master, iconMaskable512Path)

  const faviconPng = await sharp(master)
    .ensureAlpha()
    .resize(32, 32, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(faviconIcoPath, createIcoFromPng(faviconPng, 32, 32))
  await writeFile(faviconSvgPath, createFaviconSvg(), 'utf8')

  const manifest = {
    name: 'Portarium Cockpit',
    short_name: 'Portarium',
    description: 'Portarium Cockpit operational control plane UI',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1220',
    theme_color: '#0B1220',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
  await writeFile(webmanifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const metadata = {
    generatedAt: new Date().toISOString(),
    model: 'gemini-3-pro-image-preview',
    promptRef: options.promptId,
    seed: promptDef.seed,
    operator: '@45ck',
  }
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

  console.log('[cockpit:assets:app-icons] Generated app icon bundle')
}

await main()
