import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const DEFAULT_DIR = path.join(
  process.cwd(),
  'apps',
  'cockpit',
  'public',
  'assets',
  'icons',
  'domain',
)

const PRESET_BACKGROUNDS = {
  white: [255, 255, 255],
  green: [0, 255, 0],
  blue: [0, 0, 255],
}

function parseArgs(argv) {
  const options = {
    dir: DEFAULT_DIR,
    background: 'auto',
    threshold: 42,
    softness: 24,
    files: undefined,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dir') {
      options.dir = path.resolve(argv[index + 1])
      index += 1
      continue
    }
    if (arg === '--background') {
      options.background = String(argv[index + 1] ?? 'white').toLowerCase()
      index += 1
      continue
    }
    if (arg === '--threshold') {
      options.threshold = Number(argv[index + 1])
      index += 1
      continue
    }
    if (arg === '--files') {
      const raw = argv[index + 1]
      options.files = String(raw ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => path.resolve(value))
      index += 1
      continue
    }
    if (arg === '--softness') {
      options.softness = Number(argv[index + 1])
      index += 1
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
    }
  }

  return options
}

function parseHexRgb(input) {
  const value = input.startsWith('#') ? input.slice(1) : input
  if (!/^[0-9a-f]{6}$/iu.test(value)) return undefined
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function resolveBackground(input) {
  if (input === 'auto') return 'auto'
  const preset = PRESET_BACKGROUNDS[input]
  if (preset) return preset
  const parsed = parseHexRgb(input)
  if (parsed) return parsed
  throw new Error(
    `Unsupported background "${input}". Use auto|white|green|blue or a hex color like #ffffff.`,
  )
}

async function collectPngFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectPngFiles(fullPath)))
      continue
    }
    if (entry.isFile() && fullPath.toLowerCase().endsWith('.png')) {
      files.push(fullPath)
    }
  }

  return files
}

function colorDistance(redA, greenA, blueA, redB, greenB, blueB) {
  const redDelta = redA - redB
  const greenDelta = greenA - greenB
  const blueDelta = blueA - blueB
  return Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta)
}

function sampleAutoBackground(data, width, height) {
  const sampleRadius = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 16)))
  const samplePoints = [
    [0, 0],
    [width - sampleRadius, 0],
    [0, height - sampleRadius],
    [width - sampleRadius, height - sampleRadius],
  ]

  let redSum = 0
  let greenSum = 0
  let blueSum = 0
  let count = 0

  for (const [startX, startY] of samplePoints) {
    for (let y = 0; y < sampleRadius; y += 1) {
      for (let x = 0; x < sampleRadius; x += 1) {
        const pixelIndex = ((startY + y) * width + (startX + x)) * 4
        redSum += data[pixelIndex]
        greenSum += data[pixelIndex + 1]
        blueSum += data[pixelIndex + 2]
        count += 1
      }
    }
  }

  if (count === 0) return [255, 255, 255]
  return [
    Math.round(redSum / count),
    Math.round(greenSum / count),
    Math.round(blueSum / count),
  ]
}

async function processPng(filePath, backgroundRgb, threshold, softness, dryRun) {
  const sourceBuffer = await readFile(filePath)
  const baseImage = sharp(sourceBuffer).ensureAlpha()
  const { data, info } = await baseImage.raw().toBuffer({ resolveWithObject: true })
  const [targetRed, targetGreen, targetBlue] =
    backgroundRgb === 'auto' ? sampleAutoBackground(data, info.width, info.height) : backgroundRgb
  const blurBand = Math.max(0, softness)
  let changedPixels = 0

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alphaIndex = index + 3
    const alpha = data[alphaIndex]
    if (alpha === 0) continue

    const distance = colorDistance(red, green, blue, targetRed, targetGreen, targetBlue)

    if (distance <= threshold) {
      data[alphaIndex] = 0
      changedPixels += 1
      continue
    }

    if (blurBand > 0 && distance <= threshold + blurBand) {
      const fade = (distance - threshold) / blurBand
      const nextAlpha = Math.max(0, Math.min(255, Math.round(alpha * fade)))
      if (nextAlpha < alpha) {
        data[alphaIndex] = nextAlpha
        changedPixels += 1
      }
    }
  }

  if (changedPixels > 0 && !dryRun) {
    const output = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer()
    await writeFile(filePath, output)
  }

  return changedPixels
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const backgroundRgb = resolveBackground(options.background)
  const files =
    Array.isArray(options.files) && options.files.length > 0
      ? options.files
      : await collectPngFiles(options.dir)

  let changedFiles = 0
  let changedPixels = 0
  for (const filePath of files) {
    const pixels = await processPng(
      filePath,
      backgroundRgb,
      options.threshold,
      options.softness,
      options.dryRun,
    )
    if (pixels > 0) {
      changedFiles += 1
      changedPixels += pixels
      const relative = path.relative(process.cwd(), filePath)
      console.log(
        `[cockpit:assets:icons:transparent] ${options.dryRun ? 'would update' : 'updated'} ${relative} (${pixels} px)`,
      )
    }
  }

  console.log(
    `[cockpit:assets:icons:transparent] ${options.dryRun ? 'dry-run' : 'done'} files=${changedFiles}/${files.length} pixels=${changedPixels}`,
  )
}

await main()
