
export function makeSharedStruct<T extends {
	[key in keyof T]: [
		type: Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor,
		length: number
	]
}>(
	fields: T
) {
	type StructBuffers = {
		[key in keyof T]: SharedArrayBuffer
	}
	const _buffers = {} as StructBuffers

	const hydrate = (buffers: { [key in keyof T]: SharedArrayBuffer }): void => {
		for (const key in buffers) {
			const constructor = fields[key][0]
			const buffer = buffers[key] as unknown as ArrayBuffer
			struct[key] = new constructor(buffer) as never
		}
	}

	let isInit = false
	const init = (): void => {
		isInit = true
		for (const key in fields) {
			const [type, length] = fields[key]
			const bytes = type.BYTES_PER_ELEMENT
			_buffers[key as keyof T] = new SharedArrayBuffer(length * bytes)
		}
		hydrate(_buffers)
	}

	const serialize = (): StructBuffers => {
		if (!isInit) {
			throw new Error("Call `init` before calling `serialize`")
		}
		return _buffers
	}

	const dehydrated = new Proxy({}, {
		get(_, key) { throw new Error(`Call \`hydrate\` or \`init\` before accessing ${String(key)}`) },
		set(_, key) { throw new Error(`Call \`hydrate\` or \`init\` before accessing ${String(key)}`) },
	})

	const struct = Object.assign({
		hydrate,
		init,
		serialize,
	}, Object.fromEntries(Object.keys(fields).map((key => [key, dehydrated]))) as {
		[key in keyof T]: InstanceType<T[key][0]>
	})

	return struct
}