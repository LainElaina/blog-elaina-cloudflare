import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

import { executeRoute, previewRoute } from './route-handlers.ts'
import { withLocalContentMutationLock } from '../local-content-mutation-lock.ts'

type ShareRepoSetupOptions = {
  omitArtifacts?: Array<'list' | 'categories' | 'folders' | 'storage'>
  invalidJsonArtifacts?: Array<'list' | 'categories' | 'folders' | 'storage'>
  malformedArtifacts?: Partial<Record<'list' | 'categories' | 'folders' | 'storage', string>>
}

const SHARE_ARTIFACT_PATHS = {
  list: 'public/share/list.json',
  categories: 'public/share/categories.json',
  folders: 'public/share/folders.json',
  storage: 'public/share/storage.json'
} as const

function createBaseArtifacts() {
  return {
    list: JSON.stringify(
      [
        {
          name: 'Alpha',
          logo: '/alpha.png',
          url: 'https://alpha.dev',
          description: 'alpha',
          tags: ['tool'],
          stars: 4,
          category: '设计',
          folderPath: '/收藏/工具'
        }
      ],
      null,
      2
    ),
    categories: JSON.stringify({ categories: [] }, null, 2),
    folders: JSON.stringify([], null, 2),
    storage: JSON.stringify(
      {
        version: 1,
        updatedAt: '2026-04-19T00:00:00.000Z',
        shares: {}
      },
      null,
      2
    )
  }
}

async function setupShareArtifactsRepo(options: ShareRepoSetupOptions = {}) {
  const repoDir = await mkdtemp(join(tmpdir(), 'share-migration-route-'))
  const shareDir = join(repoDir, 'public/share')
  const artifacts = createBaseArtifacts()

  await mkdir(shareDir, { recursive: true })

  for (const artifactName of Object.keys(artifacts) as Array<keyof typeof artifacts>) {
    if (options.omitArtifacts?.includes(artifactName)) {
      continue
    }

    const nextContent = options.invalidJsonArtifacts?.includes(artifactName)
      ? '{'
      : options.malformedArtifacts?.[artifactName] ?? artifacts[artifactName]

    await writeFile(join(shareDir, `${artifactName}.json`), nextContent)
  }

  return {
    repoDir,
    cleanup: async () => rm(repoDir, { recursive: true, force: true })
  }
}

async function readPreviewSnapshotHash(baseDir: string) {
  const response = await previewRoute({
    nodeEnv: 'development',
    baseDir
  })

  assert.equal(response.status, 200)
  assert.equal(typeof response.body.snapshotHash, 'string')
  return response.body.snapshotHash
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(next => {
    resolve = next
  })
  return { promise, resolve }
}


describe('share migration route handlers', () => {
  it('preview rejects non-development requests', async () => {
    const response = await previewRoute({
      nodeEnv: 'production',
      baseDir: '/tmp/unused-share-migration'
    })

    assert.equal(response.status, 403)
    assert.deepEqual(response.body, {
      ok: false,
      operation: 'preview',
      code: 'DEV_ONLY',
      message: '仅开发环境可用'
    })
  })

  it('preview strictly reads artifacts and returns the real artifactsToRebuild list', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.ok, true)
      assert.equal(response.body.operation, 'preview')
      assert.match(response.body.summary, /待重建 share 正式产物/)
      assert.equal(response.body.notice, '只处理 share 正式产物，不会修改 logo 图片。预检查基于当前磁盘快照。')
      assert.deepEqual(response.body.artifactsToRebuild, [
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured missing-artifact error', async () => {
    const context = await setupShareArtifactsRepo({
      omitArtifacts: ['storage']
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'preview',
        code: 'ARTIFACT_MISSING',
        message: '缺少 share 正式产物：public/share/storage.json',
        details: {
          artifact: SHARE_ARTIFACT_PATHS.storage
        }
      })
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured invalid-json error', async () => {
    const context = await setupShareArtifactsRepo({
      invalidJsonArtifacts: ['list']
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.ok, false)
      assert.equal(response.body.operation, 'preview')
      assert.equal(response.body.code, 'ARTIFACT_INVALID_JSON')
      assert.equal(response.body.message, 'public/share/list.json 不是合法 JSON')
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.list
      })
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured invalid-shape error', async () => {
    const context = await setupShareArtifactsRepo({
      malformedArtifacts: {
        categories: JSON.stringify({ categories: [1] }, null, 2)
      }
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.ok, false)
      assert.equal(response.body.operation, 'preview')
      assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
      assert.equal(response.body.message, 'public/share/categories.json 的内容结构不合法')
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.categories
      })
    } finally {
      await context.cleanup()
    }
  })

  it('preview returns a structured storage slug mismatch error', async () => {
    const context = await setupShareArtifactsRepo({
      malformedArtifacts: {
        storage: JSON.stringify(
          {
            version: 1,
            updatedAt: '2026-04-19T00:00:00.000Z',
            shares: {
              alpha: {
                slug: 'beta',
                name: 'Alpha',
                logo: '/alpha.png',
                url: 'https://alpha.dev',
                description: 'alpha',
                tags: ['tool'],
                stars: 4,
                status: 'published'
              }
            }
          },
          null,
          2
        )
      }
    })

    try {
      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.ok, false)
      assert.equal(response.body.operation, 'preview')
      assert.equal(response.body.code, 'ARTIFACT_INVALID_SHAPE')
      assert.equal(response.body.message, 'public/share/storage.json 的内容结构不合法')
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.storage
      })
    } finally {
      await context.cleanup()
    }
  })

  it('execute rejects false, string, number, null, and missing confirmations before touching disk', async () => {
    for (const confirmed of [false, 'true', 1, null, undefined]) {
      let readCalled = false
      let writeCalled = false

      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed,
        baseDir: '/tmp/unused-share-migration',
        readText: async () => {
          readCalled = true
          throw new Error('readText should not be called')
        },
        writeText: async () => {
          writeCalled = true
          throw new Error('writeText should not be called')
        }
      })

      assert.equal(response.status, 400)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'execute',
        code: 'UNCONFIRMED',
        message: '执行前需要明确确认'
      })
      assert.equal(readCalled, false)
      assert.equal(writeCalled, false)
    }
  })

  it('execute rejects a missing preview snapshot before writing', async () => {
    const context = await setupShareArtifactsRepo()
    let writeCalled = false

    try {
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        baseDir: context.repoDir,
        writeText: async () => {
          writeCalled = true
          throw new Error('writeText should not be called')
        }
      })

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'STALE_PREVIEW')
      assert.equal(response.body.shouldRepreview, true)
      assert.equal(writeCalled, false)
    } finally {
      await context.cleanup()
    }
  })

  it('execute rejects a stale preview snapshot before writing', async () => {
    const context = await setupShareArtifactsRepo()
    let writeCalled = false

    try {
      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const categoriesPath = join(context.repoDir, SHARE_ARTIFACT_PATHS.categories)
      const changedCategories = JSON.stringify({ categories: ['外部更新'] }, null, 2)
      await writeFile(categoriesPath, changedCategories)

      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText: async () => {
          writeCalled = true
          throw new Error('writeText should not be called')
        }
      })

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'STALE_PREVIEW')
      assert.equal(response.body.shouldRepreview, true)
      assert.equal(writeCalled, false)
      assert.equal(await readFile(categoriesPath, 'utf8'), changedCategories)
    } finally {
      await context.cleanup()
    }
  })

  it('preview rejects a symlinked share artifact directory before reading external artifacts', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'share-migration-preview-symlink-repo-'))
    const outsideDir = await mkdtemp(join(tmpdir(), 'share-migration-preview-symlink-outside-'))
    const artifacts = createBaseArtifacts()

    try {
      await mkdir(join(repoDir, 'public'), { recursive: true })
      await symlink(outsideDir, join(repoDir, 'public/share'))
      await writeFile(join(outsideDir, 'list.json'), artifacts.list)
      await writeFile(join(outsideDir, 'categories.json'), artifacts.categories)
      await writeFile(join(outsideDir, 'folders.json'), artifacts.folders)
      await writeFile(join(outsideDir, 'storage.json'), artifacts.storage)

      const response = await previewRoute({
        nodeEnv: 'development',
        baseDir: repoDir
      })

      assert.equal(response.status, 403)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'preview',
        code: 'ARTIFACT_PATH_INVALID',
        message: 'share 正式产物路径不合法'
      })
    } finally {
      await rm(repoDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('execute rejects a symlinked share artifact directory before writing', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'share-migration-symlink-repo-'))
    const outsideDir = await mkdtemp(join(tmpdir(), 'share-migration-symlink-outside-'))
    const artifacts = createBaseArtifacts()

    try {
      await mkdir(join(repoDir, 'public'), { recursive: true })
      await symlink(outsideDir, join(repoDir, 'public/share'))
      await writeFile(join(outsideDir, 'list.json'), artifacts.list)
      await writeFile(join(outsideDir, 'categories.json'), artifacts.categories)
      await writeFile(join(outsideDir, 'folders.json'), artifacts.folders)
      await writeFile(join(outsideDir, 'storage.json'), artifacts.storage)

      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash: 'stale-snapshot',
        baseDir: repoDir
      })

      assert.equal(response.status, 403)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'execute',
        code: 'ARTIFACT_PATH_INVALID',
        message: 'share 正式产物路径不合法'
      })
      assert.deepEqual(JSON.parse(await readFile(join(outsideDir, 'categories.json'), 'utf8')), { categories: [] })
      assert.deepEqual(JSON.parse(await readFile(join(outsideDir, 'folders.json'), 'utf8')), [])
      assert.deepEqual(JSON.parse(await readFile(join(outsideDir, 'storage.json'), 'utf8')), JSON.parse(artifacts.storage))
    } finally {
      await rm(repoDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('execute writes artifacts in fixed order and verifies the post-write disk state', async () => {
    const context = await setupShareArtifactsRepo()
    const writeOrder: string[] = []

    try {
      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          writeOrder.push(artifactPath)
          await writeFile(filePath, content)

          if (artifactPath === SHARE_ARTIFACT_PATHS.storage) {
            await writeFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), JSON.stringify({ categories: [] }, null, 2))
          }
        }
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.ok, true)
      assert.equal(response.body.operation, 'execute')
      assert.match(response.body.summary, /已重建 share 正式产物/)
      assert.equal(response.body.notice, '只处理 share 正式产物，不会修改 logo 图片。执行结果已基于写回后的磁盘状态复检。')
      assert.deepEqual(writeOrder, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
      assert.deepEqual(response.body.writtenArtifacts, writeOrder)
      assert.deepEqual(response.body.artifactsToRebuildBeforeExecute, [
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
      assert.deepEqual(response.body.artifactsToRebuildAfterExecute, [SHARE_ARTIFACT_PATHS.categories])

      const categoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      const foldersRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8')
      const storageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      assert.deepEqual(JSON.parse(categoriesRaw), { categories: [] })
      assert.deepEqual(JSON.parse(foldersRaw), [
        {
          name: '收藏',
          path: '/收藏',
          children: [
            {
              name: '工具',
              path: '/收藏/工具',
              children: []
            }
          ]
        }
      ])
      assert.equal(JSON.parse(storageRaw).shares.alpha?.slug, 'alpha')
    } finally {
      await context.cleanup()
    }
  })

  it('execute default writer replaces share artifacts atomically', async () => {
    const source = await readFile(new URL('./route-handlers.ts', import.meta.url), 'utf8')

    assert.match(source, /import \{ readFile, realpath, rename, rm, writeFile \} from 'node:fs\/promises'/)
    assert.match(source, /function buildAtomicShareArtifactTempPath\(filePath: string\)/)
    assert.match(source, /const defaultWriteText: WriteText = async \(filePath, content\) => \{/)
    assert.match(source, /await writeFile\(tempPath, content, \{ flag: 'wx' \}\)\n    await rename\(tempPath, filePath\)/)
    assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
    assert.doesNotMatch(source, /const defaultWriteText: WriteText = \(filePath, content\) => writeFile\(filePath, content\)/)
  })

  it('execute default writer refuses pre-existing symlinked atomic temp paths', async () => {
    const previousDateNow = Date.now
    const previousMathRandom = Math.random
    const context = await setupShareArtifactsRepo()
    const outsideDir = await mkdtemp(join(tmpdir(), 'share-migration-temp-outside-'))
    const artifactPath = SHARE_ARTIFACT_PATHS.list
    const fullPath = join(context.repoDir, artifactPath)
    const tempPath = `${fullPath}.tmp-${process.pid}-1700000000000-4fzzzxjylrx`

    try {
      const previousContent = await readFile(fullPath, 'utf8')
      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      await writeFile(join(outsideDir, 'target.txt'), 'outside', 'utf8')
      await symlink(join(outsideDir, 'target.txt'), tempPath)
      Date.now = () => 1700000000000
      Math.random = () => 0.123456789

      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir
      })

      assert.equal(response.status, 500)
      assert.equal(response.body.code, 'WRITE_FAILED')
      assert.equal(response.body.details?.artifact, artifactPath)
      assert.equal(await readFile(join(outsideDir, 'target.txt'), 'utf8'), 'outside')
      assert.equal(await readFile(fullPath, 'utf8'), previousContent)
    } finally {
      Date.now = previousDateNow
      Math.random = previousMathRandom
      await context.cleanup()
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('execute serializes concurrent confirmed migrations', async () => {
    const context = await setupShareArtifactsRepo()
    const events: string[] = []
    let releaseFirstWrite!: () => void
    const firstWriteStarted = new Promise<void>(resolve => {
      releaseFirstWrite = resolve
    })
    let firstStorageWriteRelease!: () => void
    const firstStorageWriteBlocked = new Promise<void>(resolve => {
      firstStorageWriteRelease = resolve
    })
    let storageWriteCount = 0

    try {
      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const writeText = async (filePath: string, content: string) => {
        const artifactPath = relative(context.repoDir, filePath)
        events.push(artifactPath)
        if (artifactPath === SHARE_ARTIFACT_PATHS.storage) {
          storageWriteCount += 1
          if (storageWriteCount === 1) {
            releaseFirstWrite()
            await firstStorageWriteBlocked
          }
        }
        await writeFile(filePath, content)
      }

      const firstExecute = executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText
      })
      await firstWriteStarted

      const secondExecute = executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText
      })
      await Promise.resolve()

      assert.deepEqual(events, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])

      firstStorageWriteRelease()
      const [firstResponse, secondResponse] = await Promise.all([firstExecute, secondExecute])

      assert.equal(firstResponse.status, 200)
      assert.equal(secondResponse.status, 409)
      assert.equal(secondResponse.body.code, 'STALE_PREVIEW')
      assert.deepEqual(events, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.storage
      ])
    } finally {
      firstStorageWriteRelease?.()
      await context.cleanup()
    }
  })

  it('preview waits for the shared share content mutation lock before reading', async () => {
    const context = await setupShareArtifactsRepo()
    const releaseLock = deferred()
    const lockEntered = deferred()
    const readStarted = deferred()

    try {
      const lock = withLocalContentMutationLock(context.repoDir, 'share', async () => {
        lockEntered.resolve()
        await releaseLock.promise
      })
      await lockEntered.promise

      const responsePromise = previewRoute({
        nodeEnv: 'development',
        baseDir: context.repoDir,
        readText: async filePath => {
          readStarted.resolve()
          return readFile(filePath, 'utf8')
        }
      })
      const readBeforeRelease = await Promise.race([
        readStarted.promise.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 50))
      ])

      assert.equal(readBeforeRelease, false)

      releaseLock.resolve()
      const response = await responsePromise
      await lock

      assert.equal(response.status, 200)
    } finally {
      releaseLock.resolve()
      await context.cleanup()
    }
  })

  it('execute waits for the shared share content mutation lock before reading and writing', async () => {
    const context = await setupShareArtifactsRepo()
    const releaseLock = deferred()
    const lockEntered = deferred()
    let readCalled = false
    let writeCalled = false

    try {
      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const lock = withLocalContentMutationLock(context.repoDir, 'share', async () => {
        lockEntered.resolve()
        await releaseLock.promise
      })
      await lockEntered.promise

      const responsePromise = executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        readText: async filePath => {
          readCalled = true
          return readFile(filePath, 'utf8')
        },
        writeText: async (filePath, content) => {
          writeCalled = true
          await writeFile(filePath, content)
        }
      })
      await Promise.resolve()

      assert.equal(readCalled, false)
      assert.equal(writeCalled, false)

      releaseLock.resolve()
      const response = await responsePromise
      await lock

      assert.equal(response.status, 200)
      assert.equal(readCalled, true)
      assert.equal(writeCalled, true)
    } finally {
      releaseLock.resolve()
      await context.cleanup()
    }
  })

  it('execute rolls back already written artifacts on injected mid-write failure', async () => {
    const context = await setupShareArtifactsRepo()
    const writeOrder: string[] = []

    try {
      const originalListRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8')
      const originalCategoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      const originalFoldersRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8')
      const originalStorageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          writeOrder.push(artifactPath)

          if (artifactPath === SHARE_ARTIFACT_PATHS.folders) {
            throw new Error('simulated folders write failure')
          }

          await writeFile(filePath, content)
        }
      })

      assert.deepEqual(writeOrder, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.list
      ])
      assert.equal(response.status, 500)
      assert.deepEqual(response.body, {
        ok: false,
        operation: 'execute',
        code: 'WRITE_FAILED',
        message: '写入 share 正式产物失败：public/share/folders.json',
        writtenArtifactsPartial: [],
        shouldRepreview: true,
        details: {
          artifact: SHARE_ARTIFACT_PATHS.folders
        }
      })

      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8'), originalListRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8'), originalCategoriesRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8'), originalFoldersRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8'), originalStorageRaw)
    } finally {
      await context.cleanup()
    }
  })


  it('execute reports rollback restore failures when write recovery also fails', async () => {
    const context = await setupShareArtifactsRepo()
    const writeOrder: string[] = []

    try {
      const originalListRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8')
      const originalCategoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      let foldersWriteFailed = false

      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          writeOrder.push(artifactPath)

          if (artifactPath === SHARE_ARTIFACT_PATHS.folders) {
            foldersWriteFailed = true
            throw new Error('simulated folders write failure')
          }
          if (foldersWriteFailed && artifactPath === SHARE_ARTIFACT_PATHS.categories) {
            throw new Error('simulated categories rollback failure')
          }

          await writeFile(filePath, content)
        }
      })

      assert.deepEqual(writeOrder, [
        SHARE_ARTIFACT_PATHS.list,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.folders,
        SHARE_ARTIFACT_PATHS.categories,
        SHARE_ARTIFACT_PATHS.list
      ])
      assert.equal(response.status, 500)
      assert.equal(response.body.code, 'WRITE_FAILED')
      assert.deepEqual(response.body.writtenArtifactsPartial, [SHARE_ARTIFACT_PATHS.categories])
      assert.deepEqual(response.body.details, {
        artifact: SHARE_ARTIFACT_PATHS.folders,
        rollbackFailedArtifacts: [SHARE_ARTIFACT_PATHS.categories]
      })
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8'), originalListRaw)
      assert.notEqual(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8'), originalCategoriesRaw)
    } finally {
      await context.cleanup()
    }
  })

  it('execute rolls back the current artifact when write fails after mutating it', async () => {
    const context = await setupShareArtifactsRepo()

    try {
      const originalListRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8')
      const originalCategoriesRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8')
      const originalFoldersRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8')
      const originalStorageRaw = await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8')

      const snapshotHash = await readPreviewSnapshotHash(context.repoDir)
      const response = await executeRoute({
        nodeEnv: 'development',
        confirmed: true,
        snapshotHash,
        baseDir: context.repoDir,
        writeText: async (filePath, content) => {
          const artifactPath = relative(context.repoDir, filePath)
          await writeFile(filePath, content)

          if (artifactPath === SHARE_ARTIFACT_PATHS.folders) {
            throw new Error('simulated folders post-write failure')
          }
        }
      })

      assert.equal(response.status, 500)
      assert.equal(response.body.code, 'WRITE_FAILED')
      assert.deepEqual(response.body.writtenArtifactsPartial, [])
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.list), 'utf8'), originalListRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.categories), 'utf8'), originalCategoriesRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.folders), 'utf8'), originalFoldersRaw)
      assert.equal(await readFile(join(context.repoDir, SHARE_ARTIFACT_PATHS.storage), 'utf8'), originalStorageRaw)
    } finally {
      await context.cleanup()
    }
  })
})
