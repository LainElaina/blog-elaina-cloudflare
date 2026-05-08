// open-next.config.ts
import { defineCloudflareConfig, type OpenNextConfig } from '@opennextjs/cloudflare'

const config: OpenNextConfig = {
	...defineCloudflareConfig(),
	buildCommand: 'corepack pnpm run build'
}

export default config
