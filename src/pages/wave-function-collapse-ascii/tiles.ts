export type Tile = {
	symbol: string
	is: [top: number, right: number, bottom: number, left: number]
}

export default [
	{
		symbol: ' ',
		is: [0, 0, 0, 0],
	},
	{
		symbol: '═',
		is: [0, 2, 0, 2],
	},
	{
		symbol: '║',
		is: [2, 0, 2, 0],
	},
	{
		symbol: '╔',
		is: [0, 2, 2, 0],
	},
	{
		symbol: '╗',
		is: [0, 0, 2, 2],
	},
	{
		symbol: '╚',
		is: [2, 2, 0, 0],
	},
	{
		symbol: '╝',
		is: [2, 0, 0, 2],
	},
	{
		symbol: '╠',
		is: [2, 2, 2, 0],
	},
	{
		symbol: '╣',
		is: [2, 0, 2, 2],
	},
	{
		symbol: '╦',
		is: [0, 2, 2, 2],
	},
	{
		symbol: '╩',
		is: [2, 2, 0, 2],
	},
	{
		symbol: '╬',
		is: [2, 2, 2, 2],
	},
	{
		symbol: '╨',
		is: [2, 1, 0, 1],
	},
	{
		symbol: '╧',
		is: [1, 2, 0, 2],
	},
	{
		symbol: '╤',
		is: [0, 2, 1, 2],
	},
	{
		symbol: '╥',
		is: [0, 1, 2, 1],
	},
	{
		symbol: '╙',
		is: [2, 1, 0, 0],
	},
	{
		symbol: '╘',
		is: [1, 2, 0, 0],
	},
	{
		symbol: '╒',
		is: [0, 2, 1, 0],
	},
	{
		symbol: '╓',
		is: [0, 1, 2, 0],
	},
	{
		symbol: '╕',
		is: [0, 0, 1, 2],
	},
	{
		symbol: '╖',
		is: [0, 0, 2, 1],
	},
	{
		symbol: '╜',
		is: [2, 0, 0, 1],
	},
	{
		symbol: '╛',
		is: [1, 0, 0, 2],
	},
	{
		symbol: '╪',
		is: [1, 2, 1, 2],
	},
	{
		symbol: '╫',
		is: [2, 1, 2, 1],
	},
	{
		symbol: '╞',
		is: [1, 2, 1, 0],
	},
	{
		symbol: '╟',
		is: [2, 1, 2, 0],
	},
	{
		symbol: '╡',
		is: [1, 0, 1, 2],
	},
	{
		symbol: '╢',
		is: [2, 0, 2, 1],
	},
	{
		symbol: '┐',
		is: [0, 0, 1, 1],
	},
	{
		symbol: '└',
		is: [1, 1, 0, 0],
	},
	{
		symbol: '┘',
		is: [1, 0, 0, 1],
	},
	{
		symbol: '┌',
		is: [0, 1, 1, 0],
	},
	{
		symbol: '│',
		is: [1, 0, 1, 0],
	},
	{
		symbol: '─',
		is: [0, 1, 0, 1],
	},
	{
		symbol: '┤',
		is: [1, 0, 1, 1],
	},
	{
		symbol: '┴',
		is: [1, 1, 0, 1],
	},
	{
		symbol: '┬',
		is: [0, 1, 1, 1],
	},
	{
		symbol: '├',
		is: [1, 1, 1, 0],
	},
	{
		symbol: '┼',
		is: [1, 1, 1, 1],
	},
	// {
	// 	symbol: '╵',
	// 	is: [1, 0, 0, 0],
	// },
	// {
	// 	symbol: '╷',
	// 	is: [0, 0, 1, 0],
	// },
	// {
	// 	symbol: '╶',
	// 	is: [0, 1, 0, 0],
	// },
	// {
	// 	symbol: '╴',
	// 	is: [0, 0, 0, 1],
	// },


	// {
	// 	symbol: '┍',
	// 	is: [0, 3, 1, 0],
	// },
	// {
	// 	symbol: '┎',
	// 	is: [0, 1, 3, 0],
	// },
	// {
	// 	symbol: '┏',
	// 	is: [0, 3, 3, 0],
	// },
	// {
	// 	symbol: '┑',
	// 	is: [0, 0, 1, 3],
	// },
	// {
	// 	symbol: '┒',
	// 	is: [0, 0, 3, 1],
	// },
	// {
	// 	symbol: '┓',
	// 	is: [0, 0, 3, 3],
	// },
	// {
	// 	symbol: '┕',
	// 	is: [1, 3, 0, 0],
	// },
	// {
	// 	symbol: '┖',
	// 	is: [3, 1, 0, 0],
	// },
	// {
	// 	symbol: '┗',
	// 	is: [3, 3, 0, 0],
	// },
	// {
	// 	symbol: '┙',
	// 	is: [1, 0, 0, 3],
	// },
	// {
	// 	symbol: '┚',
	// 	is: [3, 0, 0, 1],
	// },
	// {
	// 	symbol: '┛',
	// 	is: [3, 0, 0, 3],
	// },
	// {
	// 	symbol: '┝',
	// 	is: [1, 3, 1, 0],
	// },
	// {
	// 	symbol: '┞',
	// 	is: [3, 1, 1, 0],
	// },
	// {
	// 	symbol: '┟',
	// 	is: [1, 1, 3, 0],
	// },
	// {
	// 	symbol: '┠',
	// 	is: [3, 1, 3, 0],
	// },
	// {
	// 	symbol: '┡',
	// 	is: [3, 3, 1, 0],
	// },
	// {
	// 	symbol: '┢',
	// 	is: [1, 3, 3, 0],
	// },
	// {
	// 	symbol: '┣',
	// 	is: [3, 3, 3, 0],
	// },
	// {
	// 	symbol: '┥',
	// 	is: [1, 0, 1, 3],
	// },
	// {
	// 	symbol: '┦',
	// 	is: [3, 0, 1, 1],
	// },
	// {
	// 	symbol: '┧',
	// 	is: [1, 0, 3, 1],
	// },
	// {
	// 	symbol: '┨',
	// 	is: [3, 0, 3, 1],
	// },
	// {
	// 	symbol: '┩',
	// 	is: [3, 0, 1, 3],
	// },
	// {
	// 	symbol: '┪',
	// 	is: [1, 0, 3, 3],
	// },
	// {
	// 	symbol: '┫',
	// 	is: [3, 0, 3, 3],
	// },
	// {
	// 	symbol: '┭',
	// 	is: [0, 1, 1, 3],
	// },
	// {
	// 	symbol: '┮',
	// 	is: [0, 3, 1, 1],
	// },
	// {
	// 	symbol: '┯',
	// 	is: [0, 3, 1, 3],
	// },
	// {
	// 	symbol: '┰',
	// 	is: [0, 1, 3, 1],
	// },
	// {
	// 	symbol: '┱',
	// 	is: [0, 1, 3, 3],
	// },
	// {
	// 	symbol: '┲',
	// 	is: [0, 3, 3, 1],
	// },
	// {
	// 	symbol: '┳',
	// 	is: [0, 3, 3, 3],
	// },
	// {
	// 	symbol: '┵',
	// 	is: [1, 1, 0, 3],
	// },
	// {
	// 	symbol: '┶',
	// 	is: [1, 3, 0, 1],
	// },
	// {
	// 	symbol: '┷',
	// 	is: [1, 3, 0, 3],
	// },
	// {
	// 	symbol: '┸',
	// 	is: [3, 1, 0, 1],
	// },
	// {
	// 	symbol: '┹',
	// 	is: [3, 1, 0, 3],
	// },
	// {
	// 	symbol: '┺',
	// 	is: [3, 3, 0, 1],
	// },
	// {
	// 	symbol: '┻',
	// 	is: [3, 3, 0, 3],
	// },
	// {
	// 	symbol: '┽',
	// 	is: [1, 1, 1, 3],
	// },
	// {
	// 	symbol: '┾',
	// 	is: [1, 3, 1, 1],
	// },
	// {
	// 	symbol: '┿',
	// 	is: [1, 3, 1, 3],
	// },
	// {
	// 	symbol: '╀',
	// 	is: [3, 1, 1, 1],
	// },
	// {
	// 	symbol: '╁',
	// 	is: [1, 1, 3, 1],
	// },
	// {
	// 	symbol: '╂',
	// 	is: [3, 1, 3, 1],
	// },
	// {
	// 	symbol: '╃',
	// 	is: [3, 1, 1, 3],
	// },
	// {
	// 	symbol: '╄',
	// 	is: [3, 3, 1, 1],
	// },
	// {
	// 	symbol: '╅',
	// 	is: [1, 1, 3, 3],
	// },
	// {
	// 	symbol: '╆',
	// 	is: [1, 3, 3, 1],
	// },
	// {
	// 	symbol: '╇',
	// 	is: [3, 3, 1, 3],
	// },
	// {
	// 	symbol: '╈',
	// 	is: [1, 3, 3, 3],
	// },
	// {
	// 	symbol: '╉',
	// 	is: [3, 1, 3, 3],
	// },
	// {
	// 	symbol: '╊',
	// 	is: [3, 3, 3, 1],
	// },
	// {
	// 	symbol: '╋',
	// 	is: [3, 3, 3, 3],
	// },
	// {
	// 	symbol: '╼',
	// 	is: [0, 3, 0, 1],
	// },
	// {
	// 	symbol: '╽',
	// 	is: [1, 0, 3, 0],
	// },
	// {
	// 	symbol: '╾',
	// 	is: [0, 1, 0, 3],
	// },
	// {
	// 	symbol: '╿',
	// 	is: [3, 0, 0, 1],
	// },
	// {
	// 	symbol: '╸',
	// 	is: [0, 0, 0, 3],
	// },
	// {
	// 	symbol: '╹',
	// 	is: [3, 0, 0, 0],
	// },
	// {
	// 	symbol: '╺',
	// 	is: [0, 3, 0, 0],
	// },
	// {
	// 	symbol: '╻',
	// 	is: [0, 0, 3, 0],
	// },
] satisfies Tile[]