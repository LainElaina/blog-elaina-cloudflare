import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const sourceFiles = {
	about: '../app/about/services/push-about.ts',
	snippets: '../app/snippets/services/push-snippets.ts',
	layoutSave: '../app/(home)/layout-save-panel.tsx',
	homeLayout: '../app/(home)/config-dialog/home-layout.tsx',
	colorConfig: '../app/(home)/config-dialog/color-config.tsx',
	componentStore: '../components/component-store.tsx'
} as const

async function readSource(relativePath: string) {
	return (await fs.readFile(new URL(relativePath, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('remote text commit helper retries the full commit on ref conflicts', async () => {
	const source = await readSource('./remote-text-commit.ts')

	assert.match(source, /export async function commitRemoteTextFiles\(files: RemoteTextFile\[], message: string\): Promise<void>/)
	assert.match(source, /async function attemptCommit\(\): Promise<void>/)
	assert.match(source, /const ref = await getRef/)
	assert.match(source, /const tree = await createTree\([\s\S]*treeItems, ref\.sha\)/)
	assert.match(source, /const commit = await createCommit\([\s\S]*message, tree\.sha, \[ref\.sha\]\)/)
	assert.match(source, /await updateRef\([\s\S]*commit\.sha\)/)
	assert.match(source, /if \(isGitHubUpdateRefConflictError\(error\)\) \{\n\s*await attemptCommit\(\)/)
})

test('simple remote text writers use the shared retrying commit helper', async () => {
	for (const relativePath of [sourceFiles.about, sourceFiles.snippets]) {
		const source = await readSource(relativePath)

		assert.match(source, /import \{ commitRemoteTextFiles \} from '@\/lib\/remote-text-commit'/)
		assert.match(source, /await commitRemoteTextFiles\(/)
		assert.doesNotMatch(source, /updateRef/)
		assert.doesNotMatch(source, /getRef/)
	}
})

test('home config remote writers use the shared retrying commit helper', async () => {
	for (const relativePath of [sourceFiles.layoutSave, sourceFiles.homeLayout, sourceFiles.colorConfig]) {
		const source = await readSource(relativePath)

		assert.match(source, /await commitRemoteTextFiles\(/)
		assert.doesNotMatch(source, /getRef, create/)
		assert.doesNotMatch(source, /updateRef/)
	}
})

test('component store remote writes validate image content and use retrying text commits', async () => {
	const source = await readSource(sourceFiles.componentStore)
	const validateIndex = source.indexOf('await assertAllowedImageFile(pendingImageFile.file, ext)')
	const uploadIndex = source.indexOf('await commitRemoteBinaryFile(')
	const saveComponentsIndex = source.indexOf('await commitRemoteTextFiles(')

	assert.match(source, /import \{ assertAllowedImageFile, getImageFileExtension \} from '@\/lib\/image-content-validation'/)
	assert.notEqual(validateIndex, -1)
	assert.notEqual(uploadIndex, -1)
	assert.ok(validateIndex < uploadIndex)
	assert.notEqual(saveComponentsIndex, -1)
	assert.doesNotMatch(source, /fileToBase64NoPrefix/)
	assert.doesNotMatch(source, /updateRef/)
})
