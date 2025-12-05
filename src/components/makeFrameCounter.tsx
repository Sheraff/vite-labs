/**
 * A simple frame counter that returns the average FPS over the last `over` frames.
 * @param over - The number of frames to average over.
 */
export function makeFrameCounter(over: number = 30) {
	let pointer = 0
	let full = false
	const frames: number[] = Array(over).fill(0)

	/**
	 * @param delta - The time in seconds since the last frame.
	 * @returns The current frames per second (FPS) based on the average of the last `over` frames.
	 */
	return (delta: number): number => {
		frames[pointer] = delta
		pointer = (pointer + 1) % over
		if (pointer === 0) full = true
		const avg = full
			? frames.reduce((a, b) => a + b, 0) / over
			: frames.reduce((a, b, i) => (i < pointer ? a + b : a), 0) / pointer
		const fps = 1 / avg
		return fps
	}
}
