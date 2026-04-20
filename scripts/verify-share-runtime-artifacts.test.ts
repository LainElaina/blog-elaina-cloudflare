import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { LOCAL_SHARE_SAVE_PATHS } from '../src/app/share/services/share-artifacts.ts'
import {
  rebuildShareRuntimeArtifactsFromStorage,
  syncShareRuntimeArtifactsToLedger,
  type ShareRuntimeArtifactsText
} from '../src/lib/content-db/share-migration-contracts.ts'

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const VERIFY_SCRIPT_PATH = './scripts/verify-share-runtime-artifacts.ts'
const SHARE_ARTIFACT_PATHS = [
  LOCAL_SHARE_SAVE_PATHS.list,
  LOCAL_SHARE_SAVE_PATHS.categories,
  LOCAL_SHARE_SAVE_PATHS.folders,
  LOCAL_SHARE_SAVE_PATHS.storage
] as const

type VerifyScriptResult = ReturnType<typeof spawnSync>

type VerifyScriptSummary = {
  ok: boolean
  operation: string
  summary?: string
  artifactsToRebuild?: string[]
  code?: string
  message?: string
  details?: unknown
  verify?: {
    artifactsToRebuild: string[]
    touchesMarkdown: boolean
    touchesImages: boolean
    atomic: boolean
  }
  ledger?: {
    shareEntriesCount: number
  }
}

function createNoDriftArtifacts(): ShareRuntimeArtifactsText {
  const synced = syncShareRuntimeArtifactsToLedger({
    list: JSON.stringify(
      [
        {
          name: 'Alpha',
          logo: '/alpha.png',
          url: 'https://alpha.dev',
          description: 'alpha',
          tags: ['设计'],
          stars: 4,
          category: '设计',
          folderPath: '/收藏/工具'
        }
      ],
      null,
      2
    ),
    storage: JSON.stringify(
      {
        version: 1,
        updatedAt: '2026-04-19T00:00:00.000Z',
        shares: {}
      },
      null,
      2
    )
  })

  return rebuildShareRuntimeArtifactsFromStorage(synced.storage).artifacts
}

async function setupShareArtifactsRepo(overrides: Partial<ShareRuntimeArtifactsText> = {}) {
  const repoDir = await mkdtemp(join(tmpdir(), 'verify-share-runtime-artifacts-'))
  const shareDir = join(repoDir, 'public/share')
  const artifacts = {
    ...createNoDriftArtifacts(),
    ...overrides
  }

  await mkdir(shareDir, { recursive: true })
  await writeFile(join(repoDir, LOCAL_SHARE_SAVE_PATHS.list), artifacts.list)
  await writeFile(join(repoDir, LOCAL_SHARE_SAVE_PATHS.categories), artifacts.categories)
  await writeFile(join(repoDir, LOCAL_SHARE_SAVE_PATHS.folders), artifacts.folders)
  await writeFile(join(repoDir, LOCAL_SHARE_SAVE_PATHS.storage), artifacts.storage)

  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

function runVerifyScript(args: string[]): VerifyScriptResult {
  return spawnSync(
    process.execPath,
    ['--require', './test-alias-register.cjs', '--import', 'jiti/register', VERIFY_SCRIPT_PATH, ...args],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    }
  )
}

function runVerifyScriptForBaseDir(baseDir: string, extraArgs: string[] = []): VerifyScriptResult {
  return runVerifyScript([`--base-dir=${baseDir}`, ...extraArgs])
}

function parseStdoutJson(result: VerifyScriptResult): VerifyScriptSummary {
  assert.notEqual(result.stdout.trim(), '', 'stdout should contain JSON output')
  return JSON.parse(result.stdout) as VerifyScriptSummary
}

function assertHumanReadableStderr(result: VerifyScriptResult, expectedPattern: RegExp) {
  assert.match(result.stderr.trim(), expectedPattern)
  assert.doesNotMatch(result.stderr, /"ok"\s*:/)
  assert.doesNotMatch(result.stderr.trim(), /^\s*\{/)
}

async function snapshotShareArtifactTree(baseDir: string) {
  const shareDir = join(baseDir, 'public/share')
  const entries = (await readdir(shareDir, { withFileTypes: true }))
    .map(entry => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
  const relativePaths = ['.', ...entries.map(entry => entry.name)]
  const stats = Object.fromEntries(
    await Promise.all(
      relativePaths.map(async relativePath => {
        const targetPath = relativePath === '.' ? shareDir : join(shareDir, relativePath)
        const targetStat = await stat(targetPath)
        return [
          relativePath,
          {
            isDirectory: targetStat.isDirectory(),
            size: targetStat.size,
            mtimeMs: targetStat.mtimeMs,
            ctimeMs: targetStat.ctimeMs
          }
        ]
      })
    )
  ) as Record<string, { isDirectory: boolean; size: number; mtimeMs: number; ctimeMs: number }>

  return {
    entries,
    stats
  }
}

describe('verify-share-runtime-artifacts script', () => {
  it('returns exit code 0 with machine-readable JSON when no drift exists', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      const result = runVerifyScriptForBaseDir(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(result.stderr.trim(), '')
      assert.equal(summary.ok, true)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.summary, '当前 share 正式产物与账本一致，无需重建。')
      assert.deepEqual(summary.artifactsToRebuild, [])
      assert.deepEqual(summary.verify?.artifactsToRebuild, [])
      assert.equal(summary.verify?.touchesMarkdown, false)
      assert.equal(summary.verify?.touchesImages, false)
      assert.equal(summary.verify?.atomic, true)
      assert.equal(summary.ledger?.shareEntriesCount, 1)
    } finally {
      await context.cleanup()
    }
  })

  it('returns exit code 1 and reports artifactsToRebuild when drift is detected', async () => {
    const context = await setupShareArtifactsRepo({
      categories: JSON.stringify({ categories: [] }, null, 2)
    })

    try {
      const result = runVerifyScriptForBaseDir(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 1)
      assert.equal(result.stderr.trim(), '')
      assert.equal(summary.ok, true)
      assert.equal(summary.operation, 'verify')
      assert.match(summary.summary ?? '', /待重建 share 正式产物/)
      assert.deepEqual(summary.artifactsToRebuild, [LOCAL_SHARE_SAVE_PATHS.categories])
      assert.deepEqual(summary.verify?.artifactsToRebuild, [LOCAL_SHARE_SAVE_PATHS.categories])
    } finally {
      await context.cleanup()
    }
  })

  it('returns exit code 2, keeps JSON on stdout, and prints a human-readable error to stderr for invalid JSON input', async () => {
    const context = await setupShareArtifactsRepo({
      list: '{'
    })

    try {
      const result = runVerifyScriptForBaseDir(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.code, 'ARTIFACT_INVALID_JSON')
      assert.equal(summary.message, 'public/share/list.json 不是合法 JSON')
      assert.deepEqual(summary.details, {
        artifact: LOCAL_SHARE_SAVE_PATHS.list
      })
      assertHumanReadableStderr(result, /public\/share\/list\.json 不是合法 JSON/)
    } finally {
      await context.cleanup()
    }
  })

  it('returns exit code 2 for malformed artifact shapes, not only invalid JSON', async () => {
    const context = await setupShareArtifactsRepo({
      categories: JSON.stringify({ categories: '设计' }, null, 2)
    })

    try {
      const result = runVerifyScriptForBaseDir(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.code, 'ARTIFACT_INVALID_SHAPE')
      assert.equal(summary.message, 'public/share/categories.json 的内容结构不合法')
      assert.deepEqual(summary.details, {
        artifact: LOCAL_SHARE_SAVE_PATHS.categories
      })
      assertHumanReadableStderr(result, /public\/share\/categories\.json 的内容结构不合法/)
    } finally {
      await context.cleanup()
    }
  })

  it('returns exit code 2 for unknown CLI flags instead of ignoring them', async () => {
    const result = runVerifyScript(['--wat'])
    const summary = parseStdoutJson(result)

    assert.equal(result.status, 2)
    assert.equal(summary.ok, false)
    assert.equal(summary.operation, 'verify')
    assert.equal(summary.code, 'ARGUMENT_INVALID')
    assert.equal(summary.message, '未知参数：--wat')
    assertHumanReadableStderr(result, /未知参数：--wat/)
  })

  it('returns exit code 2 when --base-dir is provided without a value', async () => {
    const result = runVerifyScript(['--base-dir'])
    const summary = parseStdoutJson(result)

    assert.equal(result.status, 2)
    assert.equal(summary.ok, false)
    assert.equal(summary.operation, 'verify')
    assert.equal(summary.code, 'ARGUMENT_INVALID')
    assert.equal(summary.message, '--base-dir 需要提供路径值')
    assertHumanReadableStderr(result, /--base-dir 需要提供路径值/)
  })

  it('returns exit code 2 for unexpected runtime failures outside input validation', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      await rm(join(context.repoDir, LOCAL_SHARE_SAVE_PATHS.list))
      await mkdir(join(context.repoDir, LOCAL_SHARE_SAVE_PATHS.list))

      const result = runVerifyScriptForBaseDir(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.code, 'RUNTIME_FAILURE')
      assert.match(summary.message ?? '', /EISDIR|illegal operation on a directory/i)
      assertHumanReadableStderr(result, /EISDIR|illegal operation on a directory/i)
    } finally {
      await context.cleanup()
    }
  })

  it('does not write or touch share artifact files while verifying', async () => {
    const context = await setupShareArtifactsRepo({
      categories: JSON.stringify({ categories: [] }, null, 2)
    })

    try {
      const before = await snapshotShareArtifactTree(context.repoDir)
      const result = runVerifyScriptForBaseDir(context.repoDir)
      const after = await snapshotShareArtifactTree(context.repoDir)
      const fileContents = await Promise.all(
        SHARE_ARTIFACT_PATHS.map(async artifactPath => readFile(join(context.repoDir, artifactPath), 'utf8'))
      )

      assert.equal(result.status, 1)
      assert.deepEqual(after, before)
      assert.equal(fileContents.length, SHARE_ARTIFACT_PATHS.length)
    } finally {
      await context.cleanup()
    }
  })
})
