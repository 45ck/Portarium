import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

const repoRoot = process.cwd()
const manifestPath = path.join(
  repoRoot,
  'apps',
  'cockpit',
  'src',
  'assets',
  'manifest.json',
)
const promptCatalogPath = path.join(
  repoRoot,
  'docs',
  'assets',
  'prompts',
  'cockpit-entity-assets.yml',
)

const fallbackEnvFiles = [
  'C:/Projects/MacquarieCollege/.env',
  'C:/Projects/content-machine/.env',
]

function parseArgs(argv) {
  const options = {
    kind: undefined,
    ids: undefined,
    background: undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--kind') {
      options.kind = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--ids') {
      const rawIds = argv[index + 1]
      options.ids = rawIds
        ? rawIds
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined
      index += 1
      continue
    }
    if (arg === '--background') {
      options.background = argv[index + 1]
      index += 1
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

function mapPromptById(promptCatalog) {
  const prompts = promptCatalog?.prompts
  if (!Array.isArray(prompts)) return new Map()
  return new Map(prompts.map((prompt) => [prompt.id, prompt]))
}

function inferImageConfig(asset, promptDef) {
  const aspectRatio =
    promptDef?.aspect_ratio ??
    (asset.kind === 'icon' ? '1:1' : asset.kind === 'illustration' ? '16:9' : '3:2')
  const imageSize = asset.kind === 'icon' ? '1K' : asset.kind === 'illustration' ? '2K' : '2K'
  return { aspectRatio, imageSize }
}

function getPromptText(asset, promptDef, options) {
  if (!promptDef?.prompt || typeof promptDef.prompt !== 'string') {
    throw new Error(`Missing prompt text for promptRef ${String(promptDef?.id ?? 'unknown')}`)
  }

  const iconFramingInstruction =
    asset.kind === 'icon'
      ? [
          'Global icon constraints: use fixed 30 degree isometric perspective.',
          'Keep the primary subject centered and facing top-left for consistency across the icon set.',
          'Transparent background preferred; if not possible use pure white (#FFFFFF) with no gradient or texture.',
          'No text, no logos, no background objects, no cast shadows beyond the icon silhouette.',
        ].join(' ')
      : ''
  const backgroundInstruction = options.background
    ? [
        `Background requirement: use a ${options.background} background only.`,
        'Use a flat, uniform background with no gradient, no texture, and no vignette.',
        'Keep one centered subject and clear margin around it for post-processing transparency extraction.',
      ].join(' ')
    : ''
  const negatives = Array.isArray(promptDef.negative_prompts)
    ? promptDef.negative_prompts.join('; ')
    : ''
  return [
    promptDef.prompt,
    iconFramingInstruction,
    backgroundInstruction,
    negatives ? `Strict constraints: ${negatives}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function resolveOutputPath(asset) {
  const candidatePath = Object.values(asset.paths).find(
    (value) => typeof value === 'string' && value.startsWith('/assets/'),
  )
  if (!candidatePath) {
    throw new Error(`Asset ${asset.id} has no valid /assets path`)
  }

  const withoutExt = candidatePath.replace(/\.[a-z0-9]+$/iu, '')
  const relativePngPath = `${withoutExt}.png`
  const absolutePngPath = path.join(
    repoRoot,
    'apps',
    'cockpit',
    'public',
    relativePngPath.replace(/^\/+assets\//u, 'assets/'),
  )

  return {
    relativePngPath,
    absolutePngPath,
  }
}

async function generateImage({ apiKey, promptText, imageConfig, temperature }) {
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
        imageConfig,
        ...(typeof temperature === 'number' ? { temperature } : {}),
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

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  const apiKey = await loadGeminiApiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in env or fallback env files')
  }

  const [rawManifest, rawPromptCatalog] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(promptCatalogPath, 'utf8'),
  ])
  const manifest = JSON.parse(rawManifest)
  const promptCatalog = YAML.parse(rawPromptCatalog)
  const promptMap = mapPromptById(promptCatalog)
  const now = new Date().toISOString()

  for (const asset of manifest.assets) {
    if (cli.kind && asset.kind !== cli.kind) continue
    if (Array.isArray(cli.ids) && cli.ids.length > 0 && !cli.ids.includes(asset.id)) continue

    const promptDef = promptMap.get(asset.promptRef)
    if (!promptDef) {
      throw new Error(`Missing prompt definition for ${asset.id} promptRef=${asset.promptRef}`)
    }

    const { relativePngPath, absolutePngPath } = resolveOutputPath(asset)
    await mkdir(path.dirname(absolutePngPath), { recursive: true })

    const oldPaths = new Set(
      Object.values(asset.paths).filter((p) => typeof p === 'string'),
    )

    const promptText = getPromptText(asset, promptDef, cli)
    const imageConfig = inferImageConfig(asset, promptDef)
    const temperature = promptDef.temperature

    console.log(`[cockpit:assets:generate] Generating ${asset.id} -> ${relativePngPath}`)
    const imageBuffer = await generateImage({
      apiKey,
      promptText,
      imageConfig,
      temperature,
    })

    await writeFile(absolutePngPath, imageBuffer)

    const nextPaths = {}
    for (const key of Object.keys(asset.paths)) {
      nextPaths[key] = relativePngPath
    }
    asset.paths = nextPaths
    asset.formats = ['png']
    asset.status = 'approved'
    asset.generator = {
      model: 'gemini-3-pro-image-preview',
      createdAt: now,
      operator: '@45ck',
      ...(typeof promptDef.seed === 'number' ? { seed: promptDef.seed } : {}),
    }

    for (const oldPath of oldPaths) {
      if (!oldPath.startsWith('/assets/')) continue
      if (oldPath === relativePngPath) continue
      const absoluteOldPath = path.join(
        repoRoot,
        'apps',
        'cockpit',
        'public',
        oldPath.replace(/^\/+assets\//u, 'assets/'),
      )
      if (existsSync(absoluteOldPath)) {
        await rm(absoluteOldPath, { force: true })
      }
    }
  }

  manifest.generatedAt = now
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log('[cockpit:assets:generate] Completed manifest and asset generation')
}

await main()
