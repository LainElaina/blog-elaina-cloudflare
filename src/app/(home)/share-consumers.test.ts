import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const shareListContract = [
	{
		name: 'Alpha Share',
		logo: '/alpha.png',
		description: 'alpha description'
	}
]

test('首页 share consumers 仍直接读取 public/share/list.json', async () => {
	const [shareCardSource, mobileQuickInfoSource] = await Promise.all([
		fs.readFile(new URL('./share-card.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./mobile-quick-info.tsx', import.meta.url), 'utf-8')
	])

	assert.match(shareCardSource, /public\/share\/list\.json/)
	assert.match(mobileQuickInfoSource, /public\/share\/list\.json/)
})

test('首页 share consumers 不依赖 categories/folders/storage 正式产物', async () => {
	const [shareCardSource, mobileQuickInfoSource] = await Promise.all([
		fs.readFile(new URL('./share-card.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./mobile-quick-info.tsx', import.meta.url), 'utf-8')
	])

	for (const source of [shareCardSource, mobileQuickInfoSource]) {
		assert.doesNotMatch(source, /public\/share\/categories\.json/)
		assert.doesNotMatch(source, /public\/share\/folders\.json/)
		assert.doesNotMatch(source, /public\/share\/storage\.json/)
	}
})

test('首页 share consumer 最小契约只要求 list 项具备基础展示字段', () => {
	const item = shareListContract[0]

	assert.equal(typeof item.name, 'string')
	assert.equal(typeof item.logo, 'string')
	assert.equal(typeof item.description, 'string')
	assert.equal(item.name.length > 0, true)
	assert.equal(item.logo.length > 0, true)
	assert.equal(item.description.length > 0, true)
})

test('首页 share consumer 变化不会把首页拉进 /share 双栏导航契约', async () => {
	const [shareCardSource, mobileQuickInfoSource] = await Promise.all([
		fs.readFile(new URL('./share-card.tsx', import.meta.url), 'utf-8'),
		fs.readFile(new URL('./mobile-quick-info.tsx', import.meta.url), 'utf-8')
	])

	for (const source of [shareCardSource, mobileQuickInfoSource]) {
		assert.doesNotMatch(source, /directory/i)
		assert.doesNotMatch(source, /category tabs?/i)
		assert.doesNotMatch(source, /folders\.json/)
		assert.doesNotMatch(source, /\bfolderPath\b/)
		assert.doesNotMatch(source, /\bcategory\b/)
	}
})
