import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const cases = [
	{
		file: '../bloggers/components/create-dialog.tsx',
		stateSetter: 'setPendingAvatarItem',
		pendingName: 'pendingAvatarItem'
	},
	{
		file: '../projects/components/create-dialog.tsx',
		stateSetter: 'setPendingImageItem',
		pendingName: 'pendingImageItem'
	},
	{
		file: './components/create-dialog.tsx',
		stateSetter: 'setLogoItem',
		pendingName: 'logoItem'
	}
]

test('create dialogs revoke pending file previews before replacing or cancelling them', async () => {
	for (const { file, stateSetter, pendingName } of cases) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

		assert.match(source, /import \{ revokeFilePreviewUrls \} from '@\/lib\/upload-preview-url'/, file)
		assert.match(source, new RegExp(`${stateSetter}\\(current => \\{\\n\\s*revokeFilePreviewUrls\\(current \\? \\[current\\] : \\[\\]\\)\\n\\s*return`), file)
		assert.match(source, new RegExp(`const closeDialog = \\(\\) => \\{\\n\\s*revokeFilePreviewUrls\\(${pendingName} \\? \\[${pendingName}\\] : \\[\\]\\)\\n\\s*onClose\\(\\)`), file)
		assert.match(source, /<DialogModal open onClose=\{closeDialog\}/, file)
		assert.match(source, /<button onClick=\{closeDialog\}/, file)
	}
})

test('create dialogs keep submitted file previews alive for parent upload maps', async () => {
	for (const { file, stateSetter, pendingName } of cases) {
		const source = (await fs.readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
		const submitCall = pendingName === 'logoItem' ? 'onSave(payload)' : `onSave(formData, ${pendingName})`

		assert.match(source, new RegExp(`${submitCall.replace(/[()]/g, '\\$&')}\\n\\s*${stateSetter}\\((?:undefined|null)\\)\\n\\s*onClose\\(\\)`), file)
		assert.doesNotMatch(source, new RegExp(`${submitCall.replace(/[()]/g, '\\$&')}[\\s\\S]{0,80}revokeFilePreviewUrls`), file)
	}
})
