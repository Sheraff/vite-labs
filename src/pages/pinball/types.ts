export interface BumperConfig {
	id: string
	x: number
	y: number
	radius: number
	points: number
}

export interface TriangularBumperConfig {
	id: string
	v1: { x: number; y: number }
	v2: { x: number; y: number }
	v3: { x: number; y: number }
	points: number
	// Edge properties: true = bouncy, false = static wall
	edge1Bouncy: boolean // edge from v1 to v2
	edge2Bouncy: boolean // edge from v2 to v3
	edge3Bouncy: boolean // edge from v3 to v1
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

export interface BezierPathConfig {
	id: string
	// Cubic bezier: start, control1, control2, end
	p0: { x: number; y: number }
	p1: { x: number; y: number }
	p2: { x: number; y: number }
	p3: { x: number; y: number }
	trackWidth: number // Width of the track (slightly less than ball diameter)
}

export interface BoardConfig {
	bumpers: BumperConfig[]
	triangularBumpers: TriangularBumperConfig[]
	rails: RailConfig[]
	curves: CurveConfig[]
	flippers: FlipperConfig[]
	bezierPaths: BezierPathConfig[]
}
