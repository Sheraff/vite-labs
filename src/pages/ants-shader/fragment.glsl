#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D previous_frame;
uniform float seed;

uniform float decay_pheromone;

// operation mode
//   0 = state updates
//   1 - 4 = move in cardinal direction
// this ensures no two ants move into each other
// we use "moved" flags in the R channel to prevent ants from moving twice in one cycle
uniform uint direction;

out vec4 fragColor;


/*
R: 00000000
   │││││││└─> ant
   ││││││└──> food
   │││││└───> ant and food
   ││││└────> anthill
   │││└─────> ant moved flag
   ││└──────> ant and food moved flag
   │└───────> ??
   └────────> ??

G: 00000000
   pheromone to food countdown

B: 00000000
   pheromone to anthill countdown

A: 00000000
   ││││├┘├┘
   │││││ └──> ant previous direction
   ││││└────> ant and food previous direction
   │││└─────> ??
   ││└──────> ??
   │└───────> ??
   └────────> ??

*/

const uint ant = 1u;
const uint food = 2u;
const uint antAndFood = 4u;
const uint anthill = 8u;
const uint antMoved = 16u;
const uint antAndFoodMoved = 32u;

// const uint antPrevDir = 3u;
// const uint antAndFoodPrevDir = 12u;

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

uint vec2toDir(vec2 dir) {
	if (isVec2Equal(dir, bottom)) {
		return 1u;
	} else if (isVec2Equal(dir, top)) {
		return 2u;
	} else if (isVec2Equal(dir, right)) {
		return 3u;
	} else if (isVec2Equal(dir, left)) {
		return 4u;
	}
	return 0u;
}

vec2 dirToVec2(uint dir) {
	if (dir == 1u) {
		return bottom;
	} else if (dir == 2u) {
		return top;
	} else if (dir == 3u) {
		return right;
	} else if (dir == 4u) {
		return left;
	}
	return vec2(0, 0);
}

bool antMoveFromTo(vec2 from, vec2 dir, bool withFood) {
	// bail if `from` is out of bounds
	{
		if (from.x < 0.0 || from.x >= resolution.x) return false;
		if (from.y < 0.0 || from.y >= resolution.y) return false;
	}

	vec2 to = from + dir;

	// bail if `to` is out of bounds
	{
		if (to.x < 0.0 || to.x >= resolution.x) return false;
		if (to.y < 0.0 || to.y >= resolution.y) return false;
	}

	uint mask;
	uint movedMask;
	if (withFood) {
		mask = antAndFood;
		movedMask = antAndFoodMoved;
	} else {
		mask = ant;
		movedMask = antMoved;
	}

	// bail if
	// - `from` does not contain an ant, or
	// - `from` has moved already this cycle, or
	{
		vec4 from_rgba = texture(previous_frame, from / resolution.xy);
		uint from_r = uint(from_rgba.x * 255.0);
		bool isAntFrom = (from_r & mask) > 0u;
		if (!isAntFrom) return false;
		bool isAntFromMoved = (from_r & movedMask) > 0u;
		if (isAntFromMoved) return false;
	}

	// bail if `to` already contains an ant
	{
		vec4 to_rgba = texture(previous_frame, to / resolution.xy);
		uint to_r = uint(to_rgba.x * 255.0);
		bool isAntTo = (to_r & mask) > 0u;
		if (isAntTo) return false;
		if (withFood) {
			bool isFood = (to_r & food) > 0u;
			if (isFood) return false; // can't move onto food
		}
	}

	// some direction is the favored pheromone gradient
	{
		uint current_g = cellValue(from, vec2(0, 0), withFood);
		uint top_g = cellValue(from, top, withFood) + cellValue(from, top+top, withFood) + cellValue(from, top+left, withFood) + cellValue(from, top+right, withFood) + cellValue(from, top+top+top, withFood) + cellValue(from, top+top+left, withFood) + cellValue(from, top+top+right, withFood);
		uint right_g = cellValue(from, right, withFood) + cellValue(from, right+right, withFood) + cellValue(from, right+top, withFood) + cellValue(from, right+bottom, withFood) + cellValue(from, right+right+right, withFood) + cellValue(from, right+right+top, withFood) + cellValue(from, right+right+bottom, withFood);
		uint bottom_g = cellValue(from, bottom, withFood) + cellValue(from, bottom+bottom, withFood) + cellValue(from, bottom+left, withFood) + cellValue(from, bottom+right, withFood) + cellValue(from, bottom+bottom+bottom, withFood) + cellValue(from, bottom+bottom+left, withFood) + cellValue(from, bottom+bottom+right, withFood);
		uint left_g = cellValue(from, left, withFood) + cellValue(from, left+left, withFood) + cellValue(from, left+top, withFood) + cellValue(from, left+bottom, withFood) + cellValue(from, left+left+left, withFood) + cellValue(from, left+left+top, withFood) + cellValue(from, left+left+bottom, withFood);

		uint max_neighbor = max(max(top_g, right_g), max(bottom_g, left_g));

		if (max_neighbor > 0u) {
			if (isVec2Equal(dir, top)) {
				if (top_g == max_neighbor) return true;
			} else if (isVec2Equal(dir, right)) {
				if (right_g == max_neighbor) return true;
			} else if (isVec2Equal(dir, bottom)) {
				if (bottom_g == max_neighbor) return true;
			} else if (isVec2Equal(dir, left)) {
				if (left_g == max_neighbor) return true;
			}
		}
	}

	// some direction is the least opposite pheromone gradient
	{
		uint alt_top_g = cellValue(from, top, !withFood);
		uint alt_right_g = cellValue(from, right, !withFood);
		uint alt_bottom_g = cellValue(from, bottom, !withFood);
		uint alt_left_g = cellValue(from, left, !withFood);

		uint min_alt_g = min(min(alt_top_g, alt_right_g), min(alt_bottom_g, alt_left_g));

		uint min_count = 0u;
		if (alt_top_g == min_alt_g) min_count++;
		if (alt_right_g == min_alt_g) min_count++;
		if (alt_bottom_g == min_alt_g) min_count++;
		if (alt_left_g == min_alt_g) min_count++;

		if (min_count != 4u) {
			// select randomly among all minimums
			float r = rand(from);
			float step = 1.0 / float(min_count);
			uint step_count = 0u;
			if (alt_top_g == min_alt_g) {
				step_count++;
				if (r < float(step_count) * step) {
					return isVec2Equal(dir, top);
				}
			}
			if (alt_right_g == min_alt_g) {
				step_count++;
				if (r < float(step_count) * step) {
					return isVec2Equal(dir, right);
				}
			}
			if (alt_bottom_g == min_alt_g) {
				step_count++;
				if (r < float(step_count) * step) {
					return isVec2Equal(dir, bottom);
				}
			}
			if (alt_left_g == min_alt_g) {
				step_count++;
				if (r < float(step_count) * step) {
					return isVec2Equal(dir, left);
				}
			}
			return false;
		}
	}
	
	// no pheromone, move randomly
	{
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
	uint a = uint(rgba.a * 255.0);

	bool isAnt = (r & ant) > 0u;
	bool isFood = (r & food) > 0u;
	bool isAntAndFood = (r & antAndFood) > 0u;
	bool isAnthill = (r & anthill) > 0u;
	bool isAntMoved = (r & antMoved) > 0u;
	bool isAntAndFoodMoved = (r & antAndFoodMoved) > 0u;

	if (direction == 0u) {
		if (decay_pheromone > 0.0) {
			if (g > 0u) {
				g -= 1u;
			}
			if (b > 0u) {
				b -= 1u;
			}
		}

		r &= ~antMoved;
		r &= ~antAndFoodMoved;

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
			b = min(maxPheromone, b + 4u);
			// b = maxPheromone;
		}
		if (isAntAndFood) {
			g = min(maxPheromone, g + 4u);
			// g = maxPheromone;
		}
	} else {
		vec2 out_dir = dirToVec2(direction);

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
				r |= antMoved;
				isAntMoved = true;
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
				r |= antAndFoodMoved;
				isAntAndFoodMoved = true;
			}
		}
	}


	fragColor = vec4(
		float(r) / 255.0,
		float(g) / 255.0,
		float(b) / 255.0,
		float(a) / 255.0
	);
}
