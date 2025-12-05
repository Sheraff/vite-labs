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
	side: "left" | "right"
	length: number
	width: number
}

export interface BezierPathConfig {
	id: string
	// Array of points forming cubic bezier segments
	// Minimum 4 points (1 segment), then +3 for each additional segment
	// e.g., [p0, p1, p2, p3] = 1 segment, [p0, p1, p2, p3, p4, p5, p6] = 2 segments
	points: Array<{ x: number; y: number }>
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
