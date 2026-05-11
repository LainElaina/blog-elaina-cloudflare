import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { withLocalContentMutationLock } from './local-content-mutation-lock.ts'

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
}

function waitForRetry() {
	return new Promise<void>(resolve => setTimeout(resolve, 50))
}

function getFileLockDir(baseDir: string, scope: 'blog' | 'share' | 'site-config' | 'content') {
	const lockKey = `${resolve(baseDir)}:${scope}`
	const lockId = createHash('sha256').update(lockKey).digest('hex')
	return join(tmpdir(), 'blog-elaina-content-locks', lockId)
}

test('local content mutation lock serializes callbacks for the same project and scope', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'local-content-lock-'))
	const releaseFirst = deferred()
	const firstEntered = deferred()
	const events: string[] = []

	try {
		const first = withLocalContentMutationLock(tmpDir, 'share', async () => {
			events.push('first:start')
			firstEntered.resolve()
			await releaseFirst.promise
			events.push('first:end')
		})
		await firstEntered.promise

		const second = withLocalContentMutationLock(tmpDir, 'share', async () => {
			events.push('second:start')
		})
		await Promise.resolve()

		assert.deepEqual(events, ['first:start'])

		releaseFirst.resolve()
		await Promise.all([first, second])

		assert.deepEqual(events, ['first:start', 'first:end', 'second:start'])
	} finally {
		releaseFirst.resolve()
		await rm(tmpDir, { recursive: true, force: true })
	}
})

test('local content mutation lock keeps blog and share scopes independent', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'local-content-lock-scope-'))
	const releaseShare = deferred()
	const shareEntered = deferred()
	const events: string[] = []

	try {
		const share = withLocalContentMutationLock(tmpDir, 'share', async () => {
			events.push('share:start')
			shareEntered.resolve()
			await releaseShare.promise
			events.push('share:end')
		})
		await shareEntered.promise

		await withLocalContentMutationLock(tmpDir, 'blog', async () => {
			events.push('blog:start')
		})

		assert.deepEqual(events, ['share:start', 'blog:start'])

		releaseShare.resolve()
		await share

		assert.deepEqual(events, ['share:start', 'blog:start', 'share:end'])
	} finally {
		releaseShare.resolve()
		await rm(tmpDir, { recursive: true, force: true })
	}
})

test('local content mutation lock waits for an existing file lock before entering callback', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'local-content-lock-file-'))
	const lockDir = getFileLockDir(tmpDir, 'share')
	const events: string[] = []

	try {
		await mkdir(lockDir, { recursive: true })
		await writeFile(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
		const lockPromise = withLocalContentMutationLock(tmpDir, 'share', async () => {
			events.push('entered')
		})

		await waitForRetry()
		assert.deepEqual(events, [])

		await rm(lockDir, { recursive: true, force: true })
		await lockPromise

		assert.deepEqual(events, ['entered'])
	} finally {
		await rm(lockDir, { recursive: true, force: true })
		await rm(tmpDir, { recursive: true, force: true })
	}
})

test('local content mutation lock removes stale file locks from dead processes', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'local-content-lock-stale-'))
	const lockDir = getFileLockDir(tmpDir, 'share')
	const events: string[] = []

	try {
		await mkdir(lockDir, { recursive: true })
		await writeFile(join(lockDir, 'owner.json'), JSON.stringify({ pid: -1, createdAt: Date.now() }))

		await withLocalContentMutationLock(tmpDir, 'share', async () => {
			events.push('entered')
		})

		assert.deepEqual(events, ['entered'])
	} finally {
		await rm(lockDir, { recursive: true, force: true })
		await rm(tmpDir, { recursive: true, force: true })
	}
})

test('local content mutation lock removes expired file locks even when owner pid still exists', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'local-content-lock-expired-owner-'))
	const lockDir = getFileLockDir(tmpDir, 'share')
	const events: string[] = []
	const timedOut = Symbol('timedOut')

	try {
		await mkdir(lockDir, { recursive: true })
		await writeFile(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() - 10 * 60 * 1000 }))

		const result = await Promise.race([
			withLocalContentMutationLock(tmpDir, 'share', async () => {
				events.push('entered')
				return 'entered'
			}),
			new Promise<typeof timedOut>(resolve => setTimeout(() => resolve(timedOut), 100))
		])

		assert.equal(result, 'entered')
		assert.deepEqual(events, ['entered'])
	} finally {
		await rm(lockDir, { recursive: true, force: true })
		await rm(tmpDir, { recursive: true, force: true })
	}
})
