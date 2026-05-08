import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { withLocalContentMutationLock } from './local-content-mutation-lock.ts'
import { withSiteConfigLocalMutationLock } from './site-config-local-shared.ts'

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>(next => {
		resolve = next
	})
	return { promise, resolve }
}

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
