export type Cell = {
	x: number
	y: number
}


export type HexGrid<T extends Cell = Cell> = {
	width: number
	height: number
	[Symbol.iterator](): Generator<T, undefined, unknown>
	[index: number]: T[]
}


export function makeHexGrid<T extends Cell = Cell>(
	width: number,
	height: number,
	init: (x: number, y: number) => T = (x, y) => ({ x, y } as T)
) {
	const store: T[][] = []
	const proxiedStore: T[][] = []

	const halfArrayHandler: ProxyHandler<T[]> = {
		get: (object, key, receiver) => {
			if (isNumberKey(key)) {
				return Reflect.get(object, Math.floor(key), receiver)
			}
			return Reflect.get(object, key, receiver)
		},
		set: (object, key, value, receiver) => {
			if (isNumberKey(key)) {
				return Reflect.set(object, Math.floor(key), value, receiver)
			}
			return Reflect.set(object, key, value, receiver)
		}
	}

	for (let x = 0; x < width - 0.5; x += 0.5) {
		const _x = x * 2
		const even = !(x % 1)
		const row: T[] = []
		store[_x] = row
		proxiedStore[_x] = even ? row : new Proxy(row, halfArrayHandler)
		const start = even ? 0 : 0.5
		const max = even ? height : height - 1
		for (let y = start; y < max; y += 1) {
			const _y = y - start
			row[_y] = init(x, y)
		}
	}

	const grid = {
		width,
		height,
		*[Symbol.iterator]() {
			for (let x = 0; x < store.length; x++) {
				const row = store[x]
				for (let y = 0; y < row.length; y++) {
					yield row[y]
				}
			}
			return undefined
		},
	}

	return new Proxy(grid, {
		get: (object, key, receiver) => {
			if (isNumberKey(key)) {
				return Reflect.get(proxiedStore, key * 2, receiver)
			}
			return Reflect.get(object, key, receiver)
		},
		set: (object, key, value, receiver) => {
			if (isNumberKey(key)) {
				return Reflect.set(proxiedStore, key * 2, value, receiver)
			}
			return Reflect.set(object, key, value, receiver)
		}
	}) as HexGrid<T>
}

function isNumberKey(key: string | symbol | number): key is number {
	return typeof key === 'string' && !isNaN(Number(key))
}
