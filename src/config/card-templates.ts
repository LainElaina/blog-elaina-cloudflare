// 卡片样式模板 - 从现有卡片中提取的视觉风格
export interface CardTemplate {
	id: string
	name: string
	description: string
	style: {
		width: number
		height: number
		borderRadius?: string
		padding?: string
		background?: string
		shadow?: string
	}
}

export const CARD_TEMPLATES: CardTemplate[] = [
	{
		id: 'small-square',
		name: '小方块',
		description: '适合图标或简单信息',
		style: { width: 54, height: 54 }
	},
	{
		id: 'small-rect',
		name: '小矩形',
		description: '适合按钮组',
		style: { width: 180, height: 42 }
	},
	{
		id: 'medium-rect',
		name: '中等矩形',
		description: '适合卡片内容',
		style: { width: 266, height: 160 }
	},
	{
		id: 'large-rect',
		name: '大矩形',
		description: '适合主要内容',
		style: { width: 360, height: 200 }
	},
	{
		id: 'tall-card',
		name: '高卡片',
		description: '适合列表或详细信息',
		style: { width: 280, height: 434 }
	},
	{
		id: 'wide-button',
		name: '宽按钮',
		description: '适合社交按钮',
		style: { width: 315, height: 48 }
	}
]
