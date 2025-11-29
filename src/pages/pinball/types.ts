export interface BumperConfig {
	id: string
	x: number
	y: number
	radius: number
	points: number
}

export interface TriangularBumperConfig {
	id: string
	x: number
	y: number
	size: number
	points: number
}

export interface RailConfig {
	id: string
	x1: number
	y1: number
	x2: number
	y2: number
	radius: number
}

export interface CurveConfig {
	id: string
	x: number
	y: number
	radius: number
	startAngle: number
	endAngle: number
	thickness: number
}

export interface FlipperConfig {
	id: string
	x: number
	y: number
	side: 'left' | 'right'
	length: number
	width: number
}

export interface BoardConfig {
	bumpers: BumperConfig[]
	triangularBumpers: TriangularBumperConfig[]
	rails: RailConfig[]
	curves: CurveConfig[]
	flippers: FlipperConfig[]
}
