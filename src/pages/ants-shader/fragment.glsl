#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D previous_frame;
uniform float seed;

uniform float decay_pheromone;

// operation mode
//   0 = state updates
//   1 = move up
//   2 = move right
//   3 = move down
//   4 = move left
// this ensures no two ants move into each other
uniform uint direction;

out vec4 fragColor;



/*
R: 00000000
       │││└─> ant
       ││└──> food
       │└───> ant and food
       └────> anthill

G: 00000000
   pheromone to food countdown

B: 00000000
   pheromone to anthill countdown

*/

const uint ant = 1u;
const uint food = 2u;
const uint antAndFood = 4u;
const uint anthill = 8u;

const uint maxPheromone = 255u;

// random number [0,1] inclusive
float rand(vec2 identity) {
	vec2 seeded = identity + vec2(seed * 0.1, seed * 0.2);
	return fract(sin(dot(seeded, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 top = vec2(0, -1);
vec2 right = vec2(1, 0);
vec2 bottom = vec2(0, 1);
vec2 left = vec2(-1, 0);

uint cellValue(vec2 from, vec2 dir, bool withFood) {
	vec2 to = from + dir;
	if (to.x < 0.0 || to.x >= resolution.x) return 0u;
	if (to.y < 0.0 || to.y >= resolution.y) return 0u;
	vec4 rgba = texture(previous_frame, to / resolution.xy);
	if (withFood) {
		return uint(rgba.z * 255.0);
	} else {
		return uint(rgba.y * 255.0);
	}
}

bool isVec2Equal(vec2 a, vec2 b) {
	return a.x == b.x && a.y == b.y;
}

bool antMoveFromTo(vec2 from, vec2 dir, bool withFood) {
	{
		// bail if `from` is out of bounds
		if (from.x < 0.0 || from.x >= resolution.x) return false;
		if (from.y < 0.0 || from.y >= resolution.y) return false;
	}

	vec2 to = from + dir;
	{
		// bail if `to` is out of bounds
		if (to.x < 0.0 || to.x >= resolution.x) return false;
		if (to.y < 0.0 || to.y >= resolution.y) return false;
	}

	uint mask;
	if (withFood) {
		mask = antAndFood;
	} else {
		mask = ant;
	}

	{
		// bail if `from` does not contain an ant
		vec4 from_rgba = texture(previous_frame, from / resolution.xy);
		uint from_r = uint(from_rgba.x * 255.0);
		bool isAntFrom = (from_r & mask) > 0u;
		if (!isAntFrom) return false;
	}

	{
		// bail if `to` already contains an ant
		vec4 to_rgba = texture(previous_frame, to / resolution.xy);
		uint to_r = uint(to_rgba.x * 255.0);
		bool isAntTo = (to_r & mask) > 0u;
		if (isAntTo) return false;
	}

	uint top_g = cellValue(from, top, withFood);
	uint right_g = cellValue(from, right, withFood);
	uint bottom_g = cellValue(from, bottom, withFood);
	uint left_g = cellValue(from, left, withFood);

	if (top_g == 0u && right_g == 0u && bottom_g == 0u && left_g == 0u) {
		// no pheromone, move randomly
		float r = rand(from);
		if (r < 0.25) {
			return isVec2Equal(dir, top);
		} else if (r < 0.5) {
			return isVec2Equal(dir, right);
		} else if (r < 0.75) {
			return isVec2Equal(dir, bottom);
		} else if (r < 1.0) {
			return isVec2Equal(dir, left);
		}
		return false;
	}

	if (isVec2Equal(dir, top)) {
		return top_g >= right_g && top_g >= bottom_g && top_g >= left_g;
	} else if (isVec2Equal(dir, right)) {
		return right_g >= top_g && right_g >= bottom_g && right_g >= left_g;
	} else if (isVec2Equal(dir, bottom)) {
		return bottom_g >= top_g && bottom_g >= right_g && bottom_g >= left_g;
	} else if (isVec2Equal(dir, left)) {
		return left_g >= top_g && left_g >= right_g && left_g >= bottom_g;
	}

	return false;
}


void main() {
	// vec2 uv = (gl_FragCoord.xy + vec2(1.0, 0.0)) / resolution.xy;
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	vec4 rgba = texture(previous_frame, uv);

	uint r = uint(rgba.x * 255.0);
	uint g = uint(rgba.y * 255.0);
	uint b = uint(rgba.z * 255.0);
	// uint a = uint(rgba.a * 255.0);

	bool isAnt = (r & ant) > 0u;
	bool isFood = (r & food) > 0u;
	bool isAntAndFood = (r & antAndFood) > 0u;
	bool isAnthill = (r & anthill) > 0u;

	if (direction == 0u) {
		if (decay_pheromone > 0.0) {
			if (g > 0u) {
				g -= 1u;
			}
			if (b > 0u) {
				b -= 1u;
			}
		}

		// collect food
		if (isAnt && isFood && !isAntAndFood) {
			r |= antAndFood;
			r &= ~ant;
			r &= ~food;
			isAnt = false;
			isFood = false;
			isAntAndFood = true;
		}

		// drop food
		if (isAntAndFood && isAnthill && !isAnt) {
			r &= ~antAndFood;
			r |= ant;
			isAntAndFood = false;
			isAnt = true;
		}

		// leave pheromone trail
		if (isAnt) {
			b = maxPheromone;
		}
		if (isAntAndFood) {
			g = maxPheromone;
		}
	} else {
		vec2 out_dir;
		if (direction == 1u) {
			out_dir = top;
		} else if (direction == 2u) {
			out_dir = right;
		} else if (direction == 3u) {
			out_dir = bottom;
		} else if (direction == 4u) {
			out_dir = left;
		}

		if (isAnt) {
			// if `ant` bit is set, see if it wants to move in `direction`
			bool moved = antMoveFromTo(gl_FragCoord.xy, out_dir, false);
			if (moved) {
				r &= ~ant;
				isAnt = false;
			}
		} else {
			// if `ant` bit is free, look in `direction` for an ant to move here
			bool moved = antMoveFromTo(gl_FragCoord.xy - out_dir, out_dir, false);
			if (moved) {
				r |= ant;
				isAnt = true;
			}
		}

		if (isAntAndFood) {
			// if `antAndFood` bit is set, see if it wants to move in `direction`
			bool moved = antMoveFromTo(gl_FragCoord.xy, out_dir, true);
			if (moved) {
				r &= ~antAndFood;
				isAntAndFood = false;
			}
		} else {
			// if `antAndFood` bit is free, look in `direction` for an antAndFood to move here
			bool moved = antMoveFromTo(gl_FragCoord.xy - out_dir, out_dir, true);
			if (moved) {
				r |= antAndFood;
				isAntAndFood = true;
			}
		}
	}


	fragColor = vec4(
		float(r) / 255.0,
		float(g) / 255.0,
		float(b) / 255.0,
		rgba.a
	);
}
