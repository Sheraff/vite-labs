import type { Entity } from "./entity"

type Eaten = Map<number, Set<number>>

export async function simulate(opts: {
	entities: Entity[],
	food: ReadonlyArray<(readonly [x: number, y: number])>,
	iterations: number,
	side: number,
	frame?: (state: { entities: Entity[], i: number, eaten: Eaten }) => Promise<void> | void,
	controller?: AbortController
}, next: () => void) {
	const { controller, entities, frame, side } = opts
	let iterations = opts.iterations
	const total_iterations = iterations
	const eaten: Eaten = new Map(entities.map((_, i) => [i, new Set()]))
	while (iterations > 0) {
		if (controller?.signal.aborted) return
		if (iterations === 0) return
		iterations--

		for (let e = 0; e < entities.length; e++) {
			const entity = entities[e]
			if (!entity.state.alive) continue
			if (entity.state.x < 0) entity.state.alive = false
			if (entity.state.x > side) entity.state.alive = false
			if (entity.state.y < 0) entity.state.alive = false
			if (entity.state.y > side) entity.state.alive = false
			// if (entity.state.x < 0) entity.state.x = 0
			// if (entity.state.x > side) entity.state.x = side
			// if (entity.state.y < 0) entity.state.y = 0
			// if (entity.state.y > side) entity.state.y = side
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

			let closest_food_x = -1
			let closest_food_y = -1
			let closest_food_distance = 100
			let angle_to_food = 0
			const eaten_entity = eaten.get(e)!
			for (let f = 0; f < opts.food.length; f++) {
				if (eaten_entity.has(f)) continue
				const [food_x, food_y] = opts.food[f]
				const distance = Math.hypot(entity.state.x - food_x, entity.state.y - food_y)
				if (distance < 20) {
					entity.state.score += 100 - distance
					eaten_entity.add(f)
				} else if (distance < closest_food_distance) {
					const angle = (Math.atan2(entity.state.y - food_y, entity.state.x - food_x) + Math.PI * 2) % (Math.PI * 2) - Math.PI
					if (angle > -Math.PI / 2 && angle < Math.PI / 2) {
						closest_food_distance = distance
						closest_food_x = food_x
						closest_food_y = food_y
						angle_to_food = angle
					}
				}
			}
			let has_food_ahead = false
			let has_food_left = false
			let has_food_right = false
			if (closest_food_distance < 100) {
				has_food_ahead = Math.abs(angle_to_food - entity.state.angle) < Math.PI / 5
				has_food_left = !has_food_ahead && angle_to_food < 0 && angle_to_food > - Math.PI / 2
				has_food_right = !has_food_ahead && angle_to_food > 0 && angle_to_food < Math.PI / 2
			}

			entity.tick([
				+has_food_left,
				+has_food_ahead,
				+has_food_right,
				+has_wall_left,
				+has_wall_ahead,
				+has_wall_right,
			])

			// if (iterations % 10 === 0) {
			// 	entity.state.history.push(entity.state.x, entity.state.y)
			// 	if (entity.state.history.length >= 20) {
			// 		const firstx = entity.state.history.shift()!
			// 		const firsty = entity.state.history.shift()!
			// 		const distance = Math.hypot(entity.state.x - firstx, entity.state.y - firsty)
			// 		entity.state.score += distance
			// 	}
			// }
		}

		if (frame) {
			await frame({ entities, i: iterations, eaten })
		}
	}
	next()
}