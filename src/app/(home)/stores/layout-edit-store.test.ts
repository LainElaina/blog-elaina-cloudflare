import assert from 'node:assert/strict'
import { test } from 'node:test'

import { useCustomComponentStore, type CustomComponent } from './custom-component-store.ts'
import { useLayoutEditStore } from './layout-edit-store.ts'

const customComponent: CustomComponent = {
	id: 'custom-test',
	name: '测试组件',
	type: 'image',
	templateId: 'test-template',
	style: {
		width: 120,
		height: 160,
		order: 1,
		offsetX: 10,
		offsetY: 20,
		enabled: true
	},
	content: {
		imageUrl: '/images/test.jpg'
	}
}

test('saveEditing clears custom component edit snapshot', () => {
	useCustomComponentStore.setState({ components: [customComponent] })
	useLayoutEditStore.setState({ editing: false, snapshot: null, customComponentsSnapshot: null })

	useLayoutEditStore.getState().startEditing()
	assert.equal(useLayoutEditStore.getState().customComponentsSnapshot?.length, 1)

	useLayoutEditStore.getState().saveEditing()

	assert.equal(useLayoutEditStore.getState().editing, false)
	assert.equal(useLayoutEditStore.getState().snapshot, null)
	assert.equal(useLayoutEditStore.getState().customComponentsSnapshot, null)
})
