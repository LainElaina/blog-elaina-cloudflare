import type { ParticleMovement } from './seasonal-effects-config'

interface ParticleLike {
	driftX: number
	driftY: number
	rotate: number
}

export function getParticleAnimation(p: ParticleLike, movement: ParticleMovement = 'float', rotate: boolean) {
	if (movement === 'rise') {
		return {
			x: [0, p.driftX * 0.6, 0],
			y: [0, -Math.abs(p.driftY), -Math.abs(p.driftY) * 1.8],
			rotate: rotate ? [p.rotate, p.rotate + 24, p.rotate + 48] : p.rotate
		}
	}

	if (movement === 'fall') {
		return {
			x: [0, p.driftX, p.driftX * 0.5],
			y: [0, Math.abs(p.driftY), Math.abs(p.driftY) * 1.6],
			rotate: rotate ? [p.rotate, p.rotate + 72, p.rotate + 144] : p.rotate
		}
	}

	return {
		x: [0, p.driftX, 0],
		y: [0, p.driftY, 0],
		rotate: rotate ? [p.rotate, p.rotate + 48, p.rotate + 96] : p.rotate
	}
}
