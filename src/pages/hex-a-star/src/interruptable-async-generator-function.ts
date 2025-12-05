export default function interruptableAsyncGeneratorFunction(generator: () => AsyncGenerator) {
	let kill: boolean = false
	const iterator = generator()

	void (async function () {
		while (!kill) {
			const a = await iterator.next()
			kill = kill || !!a.done
		}
	})()

	return () => (kill = true)
}
