import type { Entity } from "./entity"

export async function simulate(opts: {
	entities: Entity[],
	iterations: number,
	side: number,
	frame?: (state: { entities: Entity[], i: number }) => Promise<void> | void,
	controller?: AbortController
}, next: () => void) {
	const { controller, entities, frame, side } = opts
	let iterations = opts.iterations
	while (iterations > 0) {
		if (controller?.signal.aborted) return
		if (iterations === 0) return
		iterations--

		for (const entity of entities) {

			if (!entity.state.alive) continue
			if (entity.state.x < 0) entity.state.alive = false
			if (entity.state.x > side) entity.state.alive = false
			if (entity.state.y < 0) entity.state.alive = false
			if (entity.state.y > side) entity.state.alive = false
			if (entity.state.angle < 0) entity.state.angle = (-((-entity.state.angle) % (Math.PI * 2))) + Math.PI * 2
			if (entity.state.angle > Math.PI * 2) entity.state.angle %= Math.PI * 2

			let has_wall_left = false
			let has_wall_ahead = false
			let has_wall_right = false
			const angle = -entity.state.angle + Math.PI / 2
			{
				const ahead_future_x = entity.state.x + Math.sin(angle) * 100
				const ahead_future_y = entity.state.y + Math.cos(angle) * 100
				has_wall_ahead = ahead_future_x < 0 || ahead_future_x > side || ahead_future_y < 0 || ahead_future_y > side
			}
			if (!has_wall_ahead) {
				const left_future_x = entity.state.x + Math.sin(angle + Math.PI / 2) * 100
				const left_future_y = entity.state.y + Math.cos(angle + Math.PI / 2) * 100
				has_wall_left = left_future_x < 0 || left_future_x > side || left_future_y < 0 || left_future_y > side
				if (!has_wall_left) {
					const right_future_x = entity.state.x + Math.sin(angle - Math.PI / 2) * 100
					const right_future_y = entity.state.y + Math.cos(angle - Math.PI / 2) * 100
					has_wall_right = right_future_x < 0 || right_future_x > side || right_future_y < 0 || right_future_y > side
				}
			}

			entity.tick([
				+has_wall_left,
				+has_wall_ahead,
				+has_wall_right,
				0,
				0,
				0,
			])

			if (iterations % 10 === 0) {
				entity.state.history.push(entity.state.x, entity.state.y)
				if (entity.state.history.length >= 20) {
					const firstx = entity.state.history.shift()!
					const firsty = entity.state.history.shift()!
					const distance = Math.hypot(entity.state.x - firstx, entity.state.y - firsty)
					entity.state.score += distance
				}
			}
		}

		if (frame) {
			await frame({ entities, i: iterations })
		}
	}
	next()
}