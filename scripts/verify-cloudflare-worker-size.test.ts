import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const VERIFY_SCRIPT_PATH = './scripts/verify-cloudflare-worker-size.js'

type VerifyScriptResult = ReturnType<typeof spawnSync>

type VerifyWorkerSizeSummary = {
  ok: boolean
  operation: string
  code?: string
  message?: string
  workerPath?: string
  rawBytes?: number
  gzipBytes?: number
  maxGzipBytes?: number
  summary?: string
}

function runVerifyScript(args: string[]): VerifyScriptResult {
  return spawnSync(process.execPath, [VERIFY_SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  })
}

function parseStdoutJson(result: VerifyScriptResult): VerifyWorkerSizeSummary {
  assert.notEqual(result.stdout.trim(), '', 'stdout should contain JSON output')
  return JSON.parse(result.stdout) as VerifyWorkerSizeSummary
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
      assert.match(summary.summary ?? '', /未超过限制/)
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
