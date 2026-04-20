import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

function runVerifyScript(baseDir: string): VerifyScriptResult {
  return spawnSync(
    process.execPath,
    ['--require', './test-alias-register.cjs', '--import', 'jiti/register', VERIFY_SCRIPT_PATH, `--base-dir=${baseDir}`],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8'
    }
  )
}

function parseStdoutJson(result: VerifyScriptResult) {
  assert.notEqual(result.stdout.trim(), '', 'stdout should contain JSON output')
  return JSON.parse(result.stdout) as {
    ok: boolean
    operation: string
    summary: string
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
}

async function readArtifactSnapshots(baseDir: string) {
  return Object.fromEntries(
    await Promise.all(
      SHARE_ARTIFACT_PATHS.map(async artifactPath => [artifactPath, await readFile(join(baseDir, artifactPath), 'utf8')])
    )
  ) as Record<(typeof SHARE_ARTIFACT_PATHS)[number], string>
}

describe('verify-share-runtime-artifacts script', () => {
  it('returns exit code 0 with machine-readable JSON when no drift exists', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      const result = runVerifyScript(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 0)
      assert.equal(result.stderr.trim(), '')
      assert.equal(summary.ok, true)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.summary, '当前 share 正式产物与账本一致，无需重建。')
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
      const result = runVerifyScript(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 1)
      assert.equal(result.stderr.trim(), '')
      assert.equal(summary.ok, true)
      assert.equal(summary.operation, 'verify')
      assert.match(summary.summary, /待重建 share 正式产物/)
      assert.deepEqual(summary.verify?.artifactsToRebuild, [LOCAL_SHARE_SAVE_PATHS.categories])
    } finally {
      await context.cleanup()
    }
  })

  it('returns exit code 2, keeps JSON on stdout, and prints a human-readable error to stderr for malformed input', async () => {
    const context = await setupShareArtifactsRepo({
      list: '{'
    })

    try {
      const result = runVerifyScript(context.repoDir)
      const summary = parseStdoutJson(result)

      assert.equal(result.status, 2)
      assert.equal(summary.ok, false)
      assert.equal(summary.operation, 'verify')
      assert.equal(summary.code, 'ARTIFACT_INVALID_JSON')
      assert.equal(summary.message, 'public/share/list.json 不是合法 JSON')
      assert.deepEqual(summary.details, {
        artifact: LOCAL_SHARE_SAVE_PATHS.list
      })
      assert.match(result.stderr, /public\/share\/list\.json 不是合法 JSON/)
    } finally {
      await context.cleanup()
    }
  })

  it('does not write any share artifact files while verifying', async () => {
    const context = await setupShareArtifactsRepo({
      categories: JSON.stringify({ categories: [] }, null, 2)
    })

    try {
      const before = await readArtifactSnapshots(context.repoDir)
      const result = runVerifyScript(context.repoDir)
      const after = await readArtifactSnapshots(context.repoDir)

      assert.equal(result.status, 1)
      assert.deepEqual(after, before)
    } finally {
      await context.cleanup()
    }
  })
})
