#!/usr/bin/env bun

/**
 * Compiles the react-demo into standalone single-file executables — one binary
 * per target that embeds the Bun runtime, the server, and the fully-bundled
 * React SPA (HTML/JS/CSS). The result needs no `bun install`, no node_modules,
 * and no separate dist at runtime: just run the binary and it serves the app.
 *
 * Why the JS API and not `bun build --compile` (the CLI)?
 *
 *   src/index.tsx imports ./index.html, which makes Bun kick off a full-stack
 *   frontend build and embed the assets. That frontend build must run
 *   bun-plugin-tailwind to turn `@import 'tailwindcss'` / `@apply` into real
 *   CSS. Per Bun's docs, `[serve.static]` plugins are "not yet supported in the
 *   CLI" — they only run through `Bun.build()`'s JS API. Compiling via the CLI
 *   therefore ships the SPA without styles, which is why the old scripts/build
 *   never worked. Passing `plugins: [tailwind]` here is the fix.
 */

import { mkdir, rm } from 'node:fs/promises'
import tailwind from 'bun-plugin-tailwind'

interface Target {
  /** Short key used on the CLI, e.g. `bun run build.ts darwin-arm64` */
  key: string
  /** Bun cross-compilation target */
  target: Bun.Build.CompileTarget
  /** Output path for the produced executable */
  outfile: string
}

const OUTDIR = 'dist'
const NAME = 'leb-react-demo'

// x64/windows use the `-modern` (Haswell, 2013+) variant for speed. If you hit
// "Illegal instruction" on older CPUs, swap to the `-baseline` variant.
const TARGETS: Target[] = [
  { key: 'darwin-arm64', target: 'bun-darwin-arm64', outfile: `${OUTDIR}/${NAME}-darwin-arm64` },
  { key: 'linux-x64', target: 'bun-linux-x64-modern', outfile: `${OUTDIR}/${NAME}-linux-x64` },
  { key: 'linux-arm64', target: 'bun-linux-arm64', outfile: `${OUTDIR}/${NAME}-linux-arm64` },
  { key: 'windows-x64', target: 'bun-windows-x64-modern', outfile: `${OUTDIR}/${NAME}-windows-x64.exe` },
]

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🏗️  Build standalone single-file executables for the react-demo

Usage: bun run build.ts [target...]

With no targets it builds all of them; otherwise it builds only the listed keys.

Targets:
${TARGETS.map(t => `  ${t.key.padEnd(13)} →  ${t.target}`).join('\n')}

Examples:
  bun run build.ts                  # all targets
  bun run build.ts darwin-arm64     # just macOS arm64
`)
  process.exit(0)
}

const requested = args.filter(a => !a.startsWith('-'))
const unknown = requested.filter(r => !TARGETS.some(t => t.key === r))
if (unknown.length) {
  console.error(`❌ Unknown target(s): ${unknown.join(', ')}`)
  console.error(`   Valid keys: ${TARGETS.map(t => t.key).join(', ')}`)
  process.exit(1)
}

const selected = requested.length ? TARGETS.filter(t => requested.includes(t.key)) : TARGETS

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

console.log(`\n🚀 Compiling ${selected.length} target${selected.length === 1 ? '' : 's'}...\n`)

await mkdir(OUTDIR, { recursive: true })

const start = performance.now()
const summary: { Target: string; Output: string; Size: string }[] = []

for (const t of selected) {
  await rm(t.outfile, { force: true })

  const result = await Bun.build({
    entrypoints: ['./src/index.tsx'],
    compile: {
      target: t.target,
      outfile: t.outfile,
    },
    plugins: [tailwind],
    minify: true,
    sourcemap: 'linked',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  })

  if (!result.success) {
    console.error(`\n❌ Failed to build ${t.key}:`)
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }

  summary.push({
    Target: t.target,
    Output: t.outfile,
    Size: formatFileSize(Bun.file(t.outfile).size),
  })
  console.log(`✅ ${t.key.padEnd(13)} → ${t.outfile}`)
}

const buildTime = ((performance.now() - start) / 1000).toFixed(2)

console.table(summary)
console.log(`\n✅ Built ${selected.length} executable${selected.length === 1 ? '' : 's'} in ${buildTime}s\n`)
