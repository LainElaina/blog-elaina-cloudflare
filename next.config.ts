import { NextConfig } from 'next'

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000

function padBuildDatePart(value: number) {
	return String(value).padStart(2, '0')
}

function formatBuildCompletedAtUtc8(date: Date) {
	const utc8Date = new Date(date.getTime() + UTC8_OFFSET_MS)
	return `${utc8Date.getUTCFullYear()}-${padBuildDatePart(utc8Date.getUTCMonth() + 1)}-${padBuildDatePart(utc8Date.getUTCDate())} ${padBuildDatePart(utc8Date.getUTCHours())}:${padBuildDatePart(utc8Date.getUTCMinutes())}:${padBuildDatePart(utc8Date.getUTCSeconds())} UTC+8`
}

const localOnlyApiModulePattern = /^(?:\.\/route-local|\.\.\/route-handlers\.ts|\.\.\/\.\.\/site-config-local-shared\.ts)$/

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_BUILD_COMPLETED_AT_UTC8: formatBuildCompletedAtUtc8(new Date())
	},
	reactStrictMode: false,
	pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
	typescript: {
		ignoreBuildErrors: true
	},
	experimental: {
		scrollRestoration: false
	},
	webpack: (config, { webpack }) => {
		config.module.rules.push({
			test: /\.svg$/i,
			use: [{ loader: '@svgr/webpack', options: { svgo: false } }]
		})

		if (process.env.NODE_ENV === 'production') {
			config.plugins = [
				...(config.plugins ?? []),
				new webpack.IgnorePlugin({ resourceRegExp: localOnlyApiModulePattern })
			]
		}

		return config
	},

	async redirects() {
		return [
			{
				source: '/zh',
				destination: '/',
				permanent: true
			},
			{
				source: '/en',
				destination: '/',
				permanent: true
			}
		]
	}
}

export default nextConfig
