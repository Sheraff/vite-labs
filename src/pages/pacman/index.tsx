import type { RouteMeta } from "#router"

import { Head } from "#components/Head"
import { useEffect, useRef } from "react"

import styles from "./styles.module.css"
import tileset_src from "./tileset.png?url"

export const meta: RouteMeta = {
	title: "Pacman",
	tags: ["wip"],
}

const TILE_SIZE = 8

export default function PacmanPage() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!

		// 28 x 36 tiles

		const width = 28 * TILE_SIZE
		const height = 36 * TILE_SIZE
		canvas.width = width
		canvas.height = height

		const screen_ratio = window.innerWidth / window.innerHeight
		const game_ratio = width / height
		if (screen_ratio > game_ratio) {
			const w = window.innerHeight * game_ratio
			const h = window.innerHeight
			canvas.style.width = `${w}px`
			canvas.style.height = `${h}px`
		} else {
			const w = window.innerWidth
			const h = window.innerWidth / game_ratio
			canvas.style.width = `${w}px`
			canvas.style.height = `${h}px`
		}

		const ctx = canvas.getContext("2d")!

		const controller = new AbortController()
		load(controller, ctx)

		return () => {
			controller.abort()
		}
	})

	return (
		<div className={styles.main}>
			<div className={styles.head}>
				<Head />
			</div>
			<canvas ref={canvasRef} />
		</div>
	)
}

function load(controller: AbortController, ctx: CanvasRenderingContext2D) {
	fetch(tileset_src, { signal: controller.signal })
		.then((response) => response.blob())
		.then((blob) => createImageBitmap(blob))
		.then((bitmap) => {
			start(controller, ctx, bitmap)
			controller.signal.addEventListener(
				"abort",
				() => {
					bitmap.close()
				},
				{ once: true },
			)
		})
		.catch((err) => {
			if (err.name === "AbortError") return
			controller.abort()
			console.error(err)
		})
}

function start(controller: AbortController, ctx: CanvasRenderingContext2D, bitmap: ImageBitmap) {
	let lastTime = 0
	let rafId = requestAnimationFrame(function up(time) {
		rafId = requestAnimationFrame(up)

		const delta = time - lastTime
		lastTime = time
		if (delta === time) return // first frame

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		const red_tiles = getColorTiles("red")

		drawTile(0 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_maze_top_left_top_left)
		drawTile(1 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(2 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(3 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(4 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(5 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(6 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(7 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(8 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(9 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(10 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(11 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(12 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(13 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_maze_top_left_top_right)
		drawTile(14 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_maze_top_right_top_left)
		drawTile(15 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(16 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(17 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(18 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(19 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(20 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(21 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(22 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(23 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(24 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(25 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(26 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_center_bottom)
		drawTile(27 * TILE_SIZE, 2 * TILE_SIZE, red_tiles.wall_maze_top_right_top_right)

		drawTile(0 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.wall_center_right)
		drawTile(1 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(2 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(3 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(4 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(5 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(6 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(7 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(8 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(9 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(10 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(11 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(12 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(13 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(14 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(15 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(16 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(17 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(18 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(19 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(20 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(21 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(22 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(23 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(24 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(25 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(26 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(27 * TILE_SIZE, 3 * TILE_SIZE, red_tiles.wall_center_left)

		drawTile(0 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_center_right)
		drawTile(1 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(2 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_left)
		drawTile(3 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(4 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(5 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_right)
		drawTile(6 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(7 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_left)
		drawTile(8 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(9 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(10 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(11 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_right)
		drawTile(12 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(13 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(14 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(15 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(16 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_left)
		drawTile(17 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(18 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(19 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(20 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_right)
		drawTile(21 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(22 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_left)
		drawTile(23 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(24 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top)
		drawTile(25 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_plain_top_right)
		drawTile(26 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(27 * TILE_SIZE, 4 * TILE_SIZE, red_tiles.wall_center_left)

		drawTile(0 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_center_right)
		drawTile(1 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_coin)
		drawTile(2 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(3 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(4 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(5 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(6 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(7 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(8 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(9 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(10 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(11 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(12 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(13 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(14 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(15 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(16 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(17 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(18 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(19 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(20 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(21 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(22 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_left)
		drawTile(23 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(24 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_center)
		drawTile(25 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_plain_right)
		drawTile(26 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.collectible_coin)
		drawTile(27 * TILE_SIZE, 5 * TILE_SIZE, red_tiles.wall_center_left)

		drawTile(0 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_center_right)
		drawTile(1 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(2 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_left)
		drawTile(3 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(4 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(5 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_right)
		drawTile(6 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(7 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_left)
		drawTile(8 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(9 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(10 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(11 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_right)
		drawTile(12 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(13 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_left)
		drawTile(14 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_right)
		drawTile(15 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(16 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_left)
		drawTile(17 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(18 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(19 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(20 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_right)
		drawTile(21 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(22 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_left)
		drawTile(23 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(24 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom)
		drawTile(25 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_plain_bottom_right)
		drawTile(26 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(27 * TILE_SIZE, 6 * TILE_SIZE, red_tiles.wall_center_left)

		drawTile(0 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.wall_center_right)
		drawTile(1 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(2 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(3 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(4 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(5 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(6 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(7 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(8 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(9 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(10 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(11 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(12 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(13 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(14 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(15 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(16 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(17 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(18 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(19 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(20 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(21 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(22 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(23 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(24 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(25 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(26 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.collectible_dot)
		drawTile(27 * TILE_SIZE, 7 * TILE_SIZE, red_tiles.wall_center_left)

		// let x = 0
		// let y = 0
		// for (const tile in red_tiles) {
		// 	drawTile(
		// 		x,
		// 		y,
		// 		red_tiles[tile as TileName],
		// 	)
		// 	x += TILE_SIZE * red_tiles[tile as TileName][2]
		// 	if (x + TILE_SIZE > ctx.canvas.width) {
		// 		x = 0
		// 		y += TILE_SIZE * 2
		// 	}
		// }
	})

	controller.signal.addEventListener(
		"abort",
		() => {
			cancelAnimationFrame(rafId)
		},
		{ once: true },
	)

	function drawTile(destX: number, destY: number, [x, y, span]: Tile) {
		ctx.drawImage(bitmap, x, y, TILE_SIZE * span, TILE_SIZE * span, destX, destY, TILE_SIZE * span, TILE_SIZE * span)
	}
}

type Tile = [x: number, y: number, span: number]

const BASE_TILE_SET = {
	alpha_0: [1, 19, 1],
	alpha_1: [10, 19, 1],
	alpha_2: [19, 19, 1],
	alpha_3: [28, 19, 1],
	alpha_4: [37, 19, 1],
	alpha_5: [46, 19, 1],
	alpha_6: [55, 19, 1],
	alpha_7: [64, 19, 1],
	alpha_8: [73, 19, 1],
	alpha_9: [82, 19, 1],
	'alpha_"': [91, 19, 1],
	"alpha_!": [109, 19, 1],
	alpha_a: [1, 28, 1],
	alpha_b: [10, 28, 1],
	alpha_c: [19, 28, 1],
	alpha_d: [28, 28, 1],
	alpha_e: [37, 28, 1],
	alpha_f: [46, 28, 1],
	alpha_g: [55, 28, 1],
	alpha_h: [64, 28, 1],
	alpha_i: [73, 28, 1],
	alpha_j: [82, 28, 1],
	alpha_k: [91, 28, 1],
	alpha_l: [100, 28, 1],
	alpha_m: [109, 28, 1],
	alpha_n: [1, 37, 1],
	alpha_o: [10, 37, 1],
	alpha_p: [19, 37, 1],
	alpha_q: [28, 37, 1],
	alpha_r: [37, 37, 1],
	alpha_s: [46, 37, 1],
	alpha_t: [55, 37, 1],
	alpha_u: [64, 37, 1],
	alpha_v: [73, 37, 1],
	alpha_w: [82, 37, 1],
	alpha_x: [91, 37, 1],
	alpha_y: [100, 37, 1],
	alpha_z: [109, 37, 1],
	ghost_right_1: [1, 83, 2],
	ghost_right_2: [18, 83, 2],
	ghost_down_1: [35, 83, 2],
	ghost_down_2: [52, 83, 2],
	ghost_left_1: [69, 83, 2],
	ghost_left_2: [86, 83, 2],
	ghost_up_1: [103, 83, 2],
	ghost_up_2: [120, 83, 2],
	ghost_dead_1: [1, 168, 2],
	ghost_dead_2: [18, 168, 2],
	death_0: [1, 134, 2],
	death_1: [18, 134, 2],
	death_2: [35, 134, 2],
	death_3: [52, 134, 2],
	death_4: [69, 134, 2],
	death_5: [86, 134, 2],
	death_6: [1, 151, 2],
	death_7: [18, 151, 2],
	death_8: [35, 151, 2],
	death_9: [52, 151, 2],
	death_10: [69, 151, 2],
	death_11: [86, 151, 2],
	pacman_right_1: [103, 134, 2],
	pacman_right_2: [103, 151, 2],
	pacman_down_1: [120, 134, 2],
	pacman_down_2: [120, 151, 2],
	pacman_plain: [103, 168, 2],
	collectible_dot: [136, 10, 1],
	collectible_coin: [136, 28, 1],
	wall_plain_top_left: [145, 1, 1],
	wall_plain_top: [154, 1, 1],
	wall_plain_top_right: [163, 1, 1],
	wall_plain_left: [145, 10, 1],
	wall_plain_center: [154, 10, 1],
	wall_plain_right: [163, 10, 1],
	wall_plain_bottom_left: [145, 19, 1],
	wall_plain_bottom: [154, 19, 1],
	wall_plain_bottom_right: [163, 19, 1],
	wall_center_top_left: [172, 1, 1],
	wall_center_top: [181, 1, 1],
	wall_center_top_right: [190, 1, 1],
	wall_center_left: [172, 10, 1],
	wall_center_empty: [181, 10, 1],
	wall_center_right: [190, 10, 1],
	wall_center_bottom_left: [172, 19, 1],
	wall_center_bottom: [181, 19, 1],
	wall_center_bottom_right: [190, 19, 1],
	wall_center_door_left: [118, 37, 1],
	wall_center_door: [127, 37, 1],
	wall_center_door_right: [136, 37, 1],
	wall_maze_top_left_top_left: [145, 28, 1],
	wall_maze_top_left_top_right: [154, 28, 1],
	wall_maze_top_left_bottom_left: [145, 37, 1],
	wall_maze_top_left_bottom_right: [154, 37, 1],
	wall_maze_top_right_top_left: [163, 28, 1],
	wall_maze_top_right_top_right: [172, 28, 1],
	wall_maze_top_right_bottom_left: [163, 37, 1],
	wall_maze_top_right_bottom_right: [172, 37, 1],
	wall_maze_bottom_left_top_left: [145, 46, 1],
	wall_maze_bottom_left_top_right: [154, 46, 1],
	wall_maze_bottom_left_bottom_left: [145, 55, 1],
	// wall_maze_bottom_left_bottom_right: [154, 55, 1],
	wall_maze_bottom_right_top_left: [163, 46, 1],
	wall_maze_bottom_right_top_right: [172, 46, 1],
	// wall_maze_bottom_right_bottom_left: [163, 55, 1],
	wall_maze_bottom_right_bottom_right: [172, 55, 1],
} satisfies Record<string, Tile>

type TileName = keyof typeof BASE_TILE_SET

const COLOR_TILESET_SIZE = [199, 187]

const COLOR_TILE_OFFSET = {
	red: [0, 0],
	pink: [1, 0],
	cyan: [2, 0],
	yellow: [3, 0],
	blue: [1, 3],
	black: [1, 1],
} satisfies Record<string, [x: number, y: number]>

type ColorName = keyof typeof COLOR_TILE_OFFSET

const getColorTiles = (color: ColorName) => {
	const offsets = COLOR_TILE_OFFSET[color]
	const offsetX = offsets[0] * COLOR_TILESET_SIZE[0]
	const offsetY = offsets[1] * COLOR_TILESET_SIZE[1]
	return Object.fromEntries(
		Object.entries(BASE_TILE_SET).map(([name, [x, y, span]]) => [name, [x + offsetX, y + offsetY, span] as Tile]),
	) as Record<TileName, Tile>
}
