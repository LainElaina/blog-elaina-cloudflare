import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const VERIFY_SCRIPT_PATH = join(REPO_ROOT, 'scripts/verify-cloudflare-worker-size.js')

type VerifyScriptResult = Omit<ReturnType<typeof spawnSync>, 'stdout' | 'stderr'> & {
  stdout: string
  stderr: string
}

type VerifyWorkerSizeArtifact = {
  workerPath: string
  rawBytes: number
  gzipBytes: number
  maxGzipBytes: number
}

type VerifyWorkerSizeSummary = {
  ok: boolean
  operation: string
  code?: string
  message?: string
  marker?: string
  workerPath?: string
  rawBytes?: number
  gzipBytes?: number
  maxGzipBytes?: number
  artifacts?: VerifyWorkerSizeArtifact[]
  summary?: string
}

function runVerifyScript(args: string[], cwd = REPO_ROOT): VerifyScriptResult {
  return spawnSync(process.execPath, [VERIFY_SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8'
  }) as VerifyScriptResult
}

function parseStdoutJson(result: VerifyScriptResult): VerifyWorkerSizeSummary {
  assert.notEqual(result.stdout.trim(), '', 'stdout should contain JSON output')
  return JSON.parse(result.stdout) as VerifyWorkerSizeSummary
}

async function writeDefaultOpenNextArtifacts(cwd: string, workerContent: string, handlerContent: string) {
  await mkdir(join(cwd, '.open-next/server-functions/default'), { recursive: true })
  await writeFile(join(cwd, '.open-next/worker.js'), workerContent)
  await writeFile(join(cwd, '.open-next/server-functions/default/handler.mjs'), handlerContent)
}

describe('verify-cloudflare-worker-size script', () => {
  it('passes when worker gzip size stays below the configured limit', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-pass-'))
    const workerPath = join(tmpDir, 'worker.js')

    try {
      await writeFile(workerPath, 'export default { fetch() { return new Response("ok") } }')
      const result = runVerifyScript([`--worker=${workerPath}`, '--max-gzip-bytes=1024'])
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(result.stderr.trim(), '')
      assert.equal(summary.ok, true)
      assert.equal(summary.operation, 'verify-cloudflare-worker-size')
      assert.equal(summary.workerPath, workerPath)
      assert.equal(typeof summary.rawBytes, 'number')
      assert.equal(typeof summary.gzipBytes, 'number')
      assert.equal(summary.maxGzipBytes, 1024)
      assert.equal(summary.artifacts?.length, 1)
      assert.equal(summary.artifacts?.[0].workerPath, workerPath)
      assert.match(summary.summary ?? '', /未超过限制/)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('checks the OpenNext worker wrapper and server handler by default', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-default-pass-'))

    try {
      await writeDefaultOpenNextArtifacts(
        tmpDir,
        'export default { fetch() { return import("./server-functions/default/handler.mjs") } }',
        'export default { async fetch() { return new Response("ok") } }'
      )
      const result = runVerifyScript(['--max-gzip-bytes=1024'], tmpDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(summary.ok, true)
      assert.deepEqual(
        summary.artifacts?.map(artifact => artifact.workerPath),
        ['.open-next/worker.js', '.open-next/server-functions/default/handler.mjs']
      )
      assert.equal(summary.workerPath, undefined)
      assert.equal(summary.gzipBytes, undefined)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails default checks when the OpenNext handler exceeds the limit', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-default-fail-'))

    try {
      await writeDefaultOpenNextArtifacts(
        tmpDir,
        'export default { fetch() { return import("./server-functions/default/handler.mjs") } }',
        Array.from({ length: 512 }, (_, index) => `const value${index} = '${index.toString(36)}'`).join('\n')
      )
      const result = runVerifyScript(['--max-gzip-bytes=256'], tmpDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.code, 'WORKER_TOO_LARGE')
      assert.equal(summary.workerPath, '.open-next/server-functions/default/handler.mjs')
      assert.equal(summary.maxGzipBytes, 256)
      assert.equal((summary.gzipBytes ?? 0) > 256, true)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails default checks when the OpenNext handler is missing', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-default-missing-'))

    try {
      await mkdir(join(tmpDir, '.open-next'), { recursive: true })
      await writeFile(join(tmpDir, '.open-next/worker.js'), 'export default {}')
      const result = runVerifyScript([], tmpDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.code, 'WORKER_MISSING')
      assert.equal(summary.workerPath, '.open-next/server-functions/default/handler.mjs')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails with machine-readable details when worker gzip size exceeds the limit', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-fail-'))
    const workerPath = join(tmpDir, 'worker.js')

    try {
      await writeFile(workerPath, Array.from({ length: 512 }, (_, index) => `const value${index} = '${index.toString(36)}'`).join('\n'))
      const result = runVerifyScript([`--worker=${workerPath}`, '--max-gzip-bytes=64'])
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.operation, 'verify-cloudflare-worker-size')
      assert.equal(summary.code, 'WORKER_TOO_LARGE')
      assert.equal(summary.workerPath, workerPath)
      assert.equal(summary.maxGzipBytes, 64)
      assert.equal((summary.gzipBytes ?? 0) > 64, true)
      assert.match(result.stderr.trim(), /超过限制/)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when worker artifacts contain local-only module markers', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-marker-fail-'))
    const workerPath = join(tmpDir, 'worker.js')

    try {
      await writeFile(workerPath, 'export default { async fetch() { return import("./route-local") } }')
      const result = runVerifyScript([`--worker=${workerPath}`, '--max-gzip-bytes=1024'])
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.code, 'WORKER_FORBIDDEN_MARKER')
      assert.equal(summary.workerPath, workerPath)
      assert.equal(summary.marker, 'route-local')
      assert.match(result.stderr.trim(), /本地专用模块标记/)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails when OpenNext server chunks contain local-only module markers', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-chunk-marker-fail-'))

    try {
      await writeDefaultOpenNextArtifacts(
        tmpDir,
        'export default { fetch() { return import("./server-functions/default/handler.mjs") } }',
        'import "./chunks/local-only.mjs"\nexport default { async fetch() { return new Response("ok") } }'
      )
      await mkdir(join(tmpDir, '.open-next/server-functions/default/chunks'), { recursive: true })
      await writeFile(join(tmpDir, '.open-next/server-functions/default/chunks/local-only.mjs'), 'export const marker = "route-local"')

      const result = runVerifyScript(['--max-gzip-bytes=1024'], tmpDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.code, 'WORKER_FORBIDDEN_MARKER')
      assert.equal(summary.workerPath, '.open-next/server-functions/default/chunks/local-only.mjs')
      assert.equal(summary.marker, 'route-local')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('ignores dependency files outside OpenNext emitted server chunks during forbidden marker scanning', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-node-modules-marker-pass-'))

    try {
      await writeDefaultOpenNextArtifacts(
        tmpDir,
        'export default { fetch() { return import("./server-functions/default/handler.mjs") } }',
        'export default { async fetch() { return new Response("ok") } }'
      )
      await mkdir(join(tmpDir, '.open-next/server-functions/default/node_modules/next/dist/client/components'), { recursive: true })
      await writeFile(join(tmpDir, '.open-next/server-functions/default/node_modules/next/dist/client/components/forbidden.js'), 'export const name = "route-handlers"')

      const result = runVerifyScript(['--max-gzip-bytes=1024'], tmpDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(summary.ok, true)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('can run a manual size-only check without forbidden marker scanning', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'verify-worker-size-marker-skip-'))
    const workerPath = join(tmpDir, 'worker.js')

    try {
      await writeFile(workerPath, 'export default { async fetch() { return import("./route-local") } }')
      const result = runVerifyScript([`--worker=${workerPath}`, '--max-gzip-bytes=1024', '--no-forbidden-marker-check'])
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(summary.ok, true)
      assert.equal(summary.workerPath, workerPath)
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('reports missing worker output clearly', () => {
    const workerPath = join(tmpdir(), `missing-worker-${Date.now()}.js`)
    const result = runVerifyScript([`--worker=${workerPath}`])
    const summary = parseStdoutJson(result)

    assert.equal(result.status, 2)
    assert.equal(summary.ok, false)
    assert.equal(summary.code, 'WORKER_MISSING')
    assert.equal(summary.workerPath, workerPath)
    assert.match(result.stderr.trim(), /未找到 Cloudflare Worker 构建产物/)
  })

  it('rejects invalid limits instead of silently skipping the guard', () => {
    const result = runVerifyScript(['--max-gzip-bytes=0'])
    const summary = parseStdoutJson(result)

    assert.equal(result.status, 2)
    assert.equal(summary.ok, false)
    assert.equal(summary.code, 'ARGUMENT_INVALID')
    assert.equal(summary.message, '--max-gzip-bytes 需要提供正整数')
  })
})
