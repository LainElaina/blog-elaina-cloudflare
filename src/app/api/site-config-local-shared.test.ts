import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { withLocalContentMutationLock } from './local-content-mutation-lock.ts'
import { withSiteConfigLocalMutationLock, writeSiteConfigFileAtomically } from './site-config-local-shared.ts'

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
}

test('site config atomic file writes refuse pre-existing symlinked temp paths', async () => {
	const previousDateNow = Date.now
	const previousMathRandom = Math.random
	const tmpDir = await mkdtemp(join(tmpdir(), 'site-config-temp-symlink-'))
	const outsideDir = await mkdtemp(join(tmpdir(), 'site-config-temp-outside-'))
	const fullPath = join(tmpDir, 'data/site-config.draft.json')
	const tempPath = `${fullPath}.tmp-${process.pid}-1700000000000-4fzzzxjylrx`
	try {
		await mkdir(dirname(fullPath), { recursive: true })
		await writeFile(fullPath, 'previous', 'utf-8')
		await writeFile(join(outsideDir, 'target.txt'), 'outside', 'utf-8')
		await symlink(join(outsideDir, 'target.txt'), tempPath)
		Date.now = () => 1700000000000
		Math.random = () => 0.123456789

		await assert.rejects(() => writeSiteConfigFileAtomically(fullPath, 'next'), /EEXIST/)

		assert.equal(await readFile(join(outsideDir, 'target.txt'), 'utf-8'), 'outside')
		assert.equal(await readFile(fullPath, 'utf-8'), 'previous')
	} finally {
		Date.now = previousDateNow
		Math.random = previousMathRandom
		await rm(tmpDir, { recursive: true, force: true })
		await rm(outsideDir, { recursive: true, force: true })
	}
})

test('site config local mutation lock serializes callbacks for the same project directory', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'site-config-lock-'))
	const releaseFirst = deferred()
	const firstEntered = deferred()
	const events: string[] = []

	try {
		const first = withSiteConfigLocalMutationLock(tmpDir, async () => {
			events.push('first:start')
			firstEntered.resolve()
			await releaseFirst.promise
			events.push('first:end')
		})
		await firstEntered.promise

		const second = withSiteConfigLocalMutationLock(tmpDir, async () => {
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

test('site config local mutation lock shares the upload resource site-config scope', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'site-config-shared-lock-'))
	const releaseFirst = deferred()
	const firstEntered = deferred()
	const events: string[] = []

	try {
		const first = withLocalContentMutationLock(tmpDir, 'site-config', async () => {
			events.push('upload:start')
			firstEntered.resolve()
			await releaseFirst.promise
			events.push('upload:end')
		})
		await firstEntered.promise

		const second = withSiteConfigLocalMutationLock(tmpDir, async () => {
			events.push('publish:start')
		})
		await Promise.resolve()

		assert.deepEqual(events, ['upload:start'])

		releaseFirst.resolve()
		await Promise.all([first, second])

		assert.deepEqual(events, ['upload:start', 'upload:end', 'publish:start'])
	} finally {
		releaseFirst.resolve()
		await rm(tmpDir, { recursive: true, force: true })
	}
})
