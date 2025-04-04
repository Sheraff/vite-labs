export const fieldMap: Record<number, Record<number, number>> = {
	'-1': {
		'-1': 0,
		'0': 1,
		'1': 2,
	},
	0: {
		'-1': 3,
		'0': 4,
		'1': 5,
	},
	1: {
		'-1': 6,
		'0': 7,
		'1': 8,
	},
}

export const reverseFieldMap: Record<number, [x: number, y: number]> = {
	0: [-1, -1],
	1: [-1, 0],
	2: [-1, 1],
	3: [0, -1],
	4: [0, 0],
	5: [0, 1],
	6: [1, -1],
	7: [1, 0],
	8: [1, 1],
}

export const ratioFieldMap: Record<number, [x: number, y: number]> = {
	0: [-0.7, -0.7],
	1: [-1, 0],
	2: [-0.7, 0.7],
	3: [0, -1],
	4: [0, 0],
	5: [0, 1],
	6: [0.7, -0.7],
	7: [1, 0],
	8: [0.7, 0.7],
}