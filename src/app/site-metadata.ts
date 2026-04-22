import type { Metadata } from 'next'
import siteContent from '@/config/site-content.json'
import { getSiteOrigin } from '@/lib/site-origin'

const {
	meta: { title, description }
} = siteContent

export const siteMetadata: Metadata = {
	metadataBase: new URL(getSiteOrigin()),
	title,
	description,
	openGraph: {
		title,
		description
	},
	twitter: {
		title,
		description
	}
}
