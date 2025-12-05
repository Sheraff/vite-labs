import type { Entity } from "./entity"

export function evaluate(entity: Entity) {
	if (!entity.state.alive) return 0
	const distanceScore = Math.hypot(entity.state.x - entity.initial.x, entity.state.y - entity.initial.y) / 100
	return entity.state.score + distanceScore
}
