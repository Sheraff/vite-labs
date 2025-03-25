#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D previous_frame;
uniform float seed;

uniform float decay_pheromone;

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
	return fract(sin(dot(identity, vec2(12.9898, 4.1414)) * seed));
}


struct Result {
	bool found;
	vec2 xy;
	uint g;
};

// the `xy` pixel is available, return the position of the ant that wants to move here
Result antMovesInto(vec2 xy, uint g) {
	if (g == 0u) return Result(false, xy, g);
	vec2 candidates[8];
	int count = 0;
	uint best_g = 255u;
	for(int dy = -1; dy <= 1; dy++) {
		for(int dx = -1; dx <= 1; dx++) {
			if(dx == 0 && dy == 0) continue;
			vec2 nxy = xy + vec2(dx, dy);
			if (nxy.x < 0.0 || nxy.x >= resolution.x) continue;
			if (nxy.y < 0.0 || nxy.y >= resolution.y) continue;
			vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
			uint nr = uint(neighbor.x * 255.0);
			bool isAnt = (nr & ant) == 1u;
			if (!isAnt) continue;
			uint ng = uint(neighbor.y * 255.0);
			if (ng == 255u) continue;
			if (ng > g) continue;
			if (ng > best_g) continue;
			if (ng < best_g) {
				best_g = ng;
				count = 0;
			}
			if (ng == g) {
				candidates[count] = nxy;
				count++;
			}
		}
	}
	if (count == 0) return Result(false, xy, g);
	float best_r = 0.0;
	vec2 best_candidate = xy;
	for(int i = 0; i < count; i++) {
		float r = rand(candidates[i]);
		if (r > best_r) {
			best_r = r;
			best_candidate = candidates[i];
		}
	}
	if (best_r == 0.0) return Result(false, xy, g);
	return Result(true, best_candidate, best_g);
}

// an ant on `xy` want to move, return the new position
Result antMovesAway(vec2 xy, uint g) {
	vec2 candidates[8];
	int count = 0;
	uint best_g = 0u;
	for(int dy = -1; dy <= 1; dy++) {
		for(int dx = -1; dx <= 1; dx++) {
			if(dx == 0 && dy == 0) continue;
			vec2 nxy = xy + vec2(dx, dy);
			if (nxy.x < 0.0 || nxy.x >= resolution.x) continue;
			if (nxy.y < 0.0 || nxy.y >= resolution.y) continue;
			vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
			uint nr = uint(neighbor.x * 255.0);
			bool isAnt = (nr & ant) == 1u;
			if (isAnt) continue;
			uint ng = uint(neighbor.y * 255.0);
			if (ng == 0u) continue;
			if (ng < g) continue;
			if (ng < best_g) continue;
			if (ng > best_g) {
				best_g = ng;
				count = 0;
			}
			if (ng == g) {
				candidates[count] = nxy;
				count++;
			}
		}
	}
	if (count == 0) return Result(false, xy, g);
	float best_r = 0.0;
	vec2 best_candidate = xy;
	for(int i = 0; i < count; i++) {
		float r = rand(candidates[i]);
		if (r > best_r) {
			best_r = r;
			best_candidate = candidates[i];
		}
	}
	if (best_r == 0.0) return Result(false, xy, g);
	return Result(true, best_candidate, best_g);
}

Result antMovesInto(vec2 xy, uint g, bool recurse) {
	Result result = antMovesInto(xy, g);
	if (!recurse) {
		return result;
	}
	if (!result.found) {
		return result;
	}
	Result mutual = antMovesAway(result.xy, result.g);
	if (mutual.found && mutual.xy.x == xy.x && mutual.xy.y == xy.y) {
		return result;
	}
	return Result(false, xy, g);
}

Result antMovesAway(vec2 xy, uint g, bool recurse) {
	Result result = antMovesAway(xy, g);
	if (!recurse) {
		return result;
	}
	if (!result.found) {
		return result;
	}
	Result mutual = antMovesInto(result.xy, result.g);
	if (mutual.found && mutual.xy.x == xy.x && mutual.xy.y == xy.y) {
		return result;
	}
	return Result(false, xy, g);
}

Result antRandomMoveAway(vec2 xy) {
	float best_r = 0.0;
	vec2 best_candidate = xy;

	for(int dy = -1; dy <= 1; dy++) {
		for(int dx = -1; dx <= 1; dx++) {
			if(dx == 0 && dy == 0) continue;
			vec2 nxy = xy + vec2(dx, dy);
			if (nxy.x < 0.0 || nxy.x >= resolution.x) continue;
			if (nxy.y < 0.0 || nxy.y >= resolution.y) continue;
			float r = rand(nxy);
			if (r <= best_r) continue;
			vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
			uint nr = uint(neighbor.x * 255.0);
			bool isAnt = (nr & ant) == 1u;
			if (isAnt) continue;
			uint ng = uint(neighbor.y * 255.0);
			Result into = antMovesInto(nxy, ng, false);
			if (into.found) continue;
			best_r = r;
			best_candidate = nxy;
		}
	}

	if (best_r == 0.0) return Result(false, xy, 0u);
	return Result(true, best_candidate, 0u);
}

Result antRandomMoveInto(vec2 xy) {
	float best_r = 1.0;
	vec2 best_candidate = xy;

	for(int dy = -1; dy <= 1; dy++) {
		for(int dx = -1; dx <= 1; dx++) {
			if(dx == 0 && dy == 0) continue;
			vec2 nxy = xy + vec2(dx, dy);
			if (nxy.x < 0.0 || nxy.x >= resolution.x) continue;
			if (nxy.y < 0.0 || nxy.y >= resolution.y) continue;
			float r = rand(nxy);
			if (r >= best_r) continue;
			vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
			uint nr = uint(neighbor.x * 255.0);
			bool isAnt = (nr & ant) == 1u;
			if (!isAnt) continue;
			uint ng = uint(neighbor.y * 255.0);
			Result away = antMovesAway(nxy, ng, false);
			if (away.found) continue;
			best_r = r;
			best_candidate = nxy;
		}
	}

	if (best_r == 1.0) return Result(false, xy, 0u);
	return Result(true, best_candidate, 0u);
}

Result antRandomMoveAway(vec2 xy, bool recurse) {
	Result result = antRandomMoveAway(xy);
	if (!recurse) {
		return result;
	}
	if (!result.found) {
		return result;
	}
	Result mutual = antRandomMoveInto(result.xy);
	if (mutual.found && mutual.xy.x == xy.x && mutual.xy.y == xy.y) {
		return result;
	}
	return Result(false, xy, 0u);
}

Result antRandomMoveInto(vec2 xy, bool recurse) {
	Result result = antRandomMoveInto(xy);
	if (!recurse) {
		return result;
	}
	if (!result.found) {
		return result;
	}
	Result mutual = antRandomMoveAway(result.xy);
	if (mutual.found && mutual.xy.x == xy.x && mutual.xy.y == xy.y) {
		return result;
	}
	return Result(false, xy, 0u);
}


void main() {
	// vec2 uv = (gl_FragCoord.xy  + vec2(1.0, 0.0)) / resolution.xy;
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	vec4 rgba = texture(previous_frame, uv);

	uint r = uint(rgba.x * 255.0);
	uint g = uint(rgba.y * 255.0);
	uint b = uint(rgba.z * 255.0);
	// uint a = uint(rgba.a * 255.0);

	if (decay_pheromone > 0.0) {
		if (g > 0u) {
			g -= 1u;
		}
		if (b > 0u) {
			b -= 1u;
		}
	}

	bool isAnt = (r & ant) == 1u;
	bool isFood = ((r & food) >> 1) == 1u;
	bool isAntAndFood = ((r & antAndFood) >> 2) == 1u;
	bool isAnthill = ((r & anthill) >> 3) == 1u;

	// collect food
	if (isAnt && isFood && !isAntAndFood) {
		r |= antAndFood;
		r &= ~ant;
		r &= ~food;
		isAnt = false;
		isFood = false;
		isAntAndFood = true;

	}

	// leave pheromone trail
	if (isAnt && !isFood) {
		b = maxPheromone;
	}
	if (isAntAndFood && !isAnthill) {
		g = maxPheromone;
	}

	// drop food
	if (isAntAndFood && isAnthill && !isAnt) {
		r &= ~antAndFood;
		r |= ant;
		isAntAndFood = false;
		isAnt = true;
	}

	// move towards food
	if (isAnt) {
		// move away from this pixel
		Result destination = antMovesAway(gl_FragCoord.xy, g, true);
		if (destination.found) {
			r &= ~ant;
			isAnt = false;
		} else {
			Result randomDestination = antRandomMoveAway(gl_FragCoord.xy, true);
			if (randomDestination.found) {
				r &= ~ant;
				isAnt = false;
			}
		}
	}
	if (!isAnt) {
		bool found = false;
		// if we have some pheromone, neighbors might want to move here
		if (g > 0u) {
			Result from = antMovesInto(gl_FragCoord.xy, g, true);
			if (from.found) {
				found = true;
				r |= ant;
				isAnt = true;
			}
		}
		// if no neighbor moved here, move a random one
		if (!found) {
			Result randomFrom = antRandomMoveInto(gl_FragCoord.xy, true);
			if (randomFrom.found) {
				found = true;
				r |= ant;
				isAnt = true;
			}
		}
	}

	// // DEBUG
	// if (isAnt) {
	// 	vec2 left = gl_FragCoord.xy + vec2(-1.0, 0.0);
	// 	if (left.x >= 0.0) {
	// 		vec4 left_rgba = texture(previous_frame, left / resolution.xy);
	// 		uint left_r = uint(left_rgba.x * 255.0);
	// 		bool left_isAnt = (left_r & ant) == 1u;
	// 		if (!left_isAnt) {
	// 			r &= ~ant;
	// 		}
	// 	}
	// }
	// if (!isAnt) {
	// 	vec2 right = gl_FragCoord.xy + vec2(1.0, 0.0);
	// 	if (right.x < resolution.x) {
	// 		vec4 right_rgba = texture(previous_frame, right / resolution.xy);
	// 		uint right_r = uint(right_rgba.x * 255.0);
	// 		bool right_isAnt = (right_r & ant) == 1u;
	// 		if (right_isAnt) {
	// 			r |= ant;
	// 		}
	// 	}
	// }

	fragColor = vec4(
		float(r) / 255.0,
		float(g) / 255.0,
		float(b) / 255.0,
		rgba.a
	);
}
