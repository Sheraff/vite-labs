import { PRECISION } from "./constants"

type Array = Uint16Array | Uint32Array | Int32Array | Uint8Array

export function load(array: Array, index: number) {
	return Atomics.load(array, index) / PRECISION
}

export function store(array: Array, index: number, value: number) {
	return Atomics.store(array, index, value * PRECISION)
}

export function exchange(array: Array, index: number, value: number) {
	return Atomics.exchange(array, index, value * PRECISION) / PRECISION
}

export function add(array: Array, index: number, value: number) {
	return Atomics.add(array, index, value * PRECISION)
}

export function sub(array: Array, index: number, value: number) {
	return Atomics.sub(array, index, value * PRECISION)
}
