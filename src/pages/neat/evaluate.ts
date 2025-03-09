import type { Entity } from "./entity"

export function evaluate(entity: Entity) {
	if (!entity.state.alive) return 0
	const score = entity.state.score * Math.hypot(entity.state.x - entity.initial.x, entity.state.y - entity.initial.y)
	return score
}