type CodeBlockMatch = { placeholder: string; code: string; preHtml: string }

function decodeCodeAttribute(value: string) {
	return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

export function extractMarkdownCodeBlocks(html: string): { processedHtml: string; codeBlocks: CodeBlockMatch[] } {
	const codeBlocks: CodeBlockMatch[] = []
	let processedHtml = ''
	let cursor = 0
	const preStartPattern = /<pre\b[^>]*\bdata-code="([^"]*)"[^>]*>/gi

	while (true) {
		preStartPattern.lastIndex = cursor
		const startMatch = preStartPattern.exec(html)
		if (!startMatch) break

		const startIndex = startMatch.index
		const contentStart = preStartPattern.lastIndex
		const preTagPattern = /<\/?pre\b[^>]*>/gi
		preTagPattern.lastIndex = contentStart
		let depth = 1
		let endIndex = -1
		let tagMatch: RegExpExecArray | null

		while ((tagMatch = preTagPattern.exec(html))) {
			depth += tagMatch[0].startsWith('</') ? -1 : 1
			if (depth === 0) {
				endIndex = tagMatch.index
				break
			}
		}

		if (endIndex === -1) break

		const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
		processedHtml += html.slice(cursor, startIndex) + placeholder
		codeBlocks.push({
			placeholder,
			code: decodeCodeAttribute(startMatch[1]),
			preHtml: html.slice(contentStart, endIndex)
		})
		cursor = preTagPattern.lastIndex
	}

	return { processedHtml: processedHtml + html.slice(cursor), codeBlocks }
}
