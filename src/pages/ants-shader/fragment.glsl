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
	return abs(sin(dot(identity, vec2(12.9898, 4.1414)) * seed));
}

void main() {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	vec4 rgba = texture(previous_frame, uv);

	uint r = uint(rgba.x * 255.0);
	uint g = uint(rgba.y * 255.0);
	uint b = uint(rgba.z * 255.0);
	// uint a = uint(rgba.a * 255.0); // unused

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
		bool found = false;
		for(int dy = -1; dy <= 1; dy++) {
			for(int dx = -1; dx <= 1; dx++) {
				if (found) continue;
				if(dx == 0 && dy == 0) continue;
				vec2 nxy = gl_FragCoord.xy + vec2(dx, dy);
				vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
				uint ng = uint(neighbor.y * 255.0);
				if (ng > g) {
					// before moving, we need to make sure that this neighbor will not move *another* ant to them
					found = true;
					r &= ~ant;
					isAnt = false;
				}
			}
		}
	}
	if (!isAnt) {
		// "gather" from surrounding pixels (loop over 8 pixels, if one has an ant and that ant needs to move here, then move here)
		bool found = false;
		bool some = false;
		// if we have some pheromone, neighbors might want to move here
		if (g > 0u) {
			for(int dy = -1; dy <= 1; dy++) {
				for(int dx = -1; dx <= 1; dx++) {
					if(dx == 0 && dy == 0) continue;
					vec2 nxy = gl_FragCoord.xy + vec2(dx, dy);
					vec4 neighbor = texture(previous_frame, nxy / resolution.xy);
					uint nr = uint(neighbor.x * 255.0);
					bool nIsAnt = (nr & ant) == 1u;
					if (!nIsAnt) continue;
					some = true;
					uint ng = uint(neighbor.y * 255.0);
					if (ng >= g) continue;
					bool elsewhere_is_better = false;
					for(int ndy = -1; ndy <= 1; ndy++) {
						for(int ndx = -1; ndx <= 1; ndx++) {
							if (elsewhere_is_better) continue;
							if (ndx == 0 && ndy == 0) continue; // avoid neighbor itself
							if (ndx == -dx && ndy == -dy) continue; // avoid current pixel
							vec4 nn = texture(previous_frame, (nxy + vec2(ndx, ndy)) / resolution.xy);
							uint nng = uint(nn.y * 255.0);
							if (nng > g) {
								elsewhere_is_better = true;
							}
						}
					}
					if (!elsewhere_is_better) {
						// move here
						// how can we move here, while ensuring that another pixel (with the exact same g value) doesn't move the same ant to them?
						// to solve this, we need to be deterministic about which neighbor wins
						// we can use the x,y coordinates of each candidate pixel to draw a random number
						// the one w/ the highest random number wins (if it's not this current pixel, do nothing)
						found = true;
						r |= ant;
						isAnt = true;
					}
				}
			}
		}
		// if no neighbor moved here, move a random one
		// how can we move a random one, while ensuring that another pixel doesn't move the same ant to them?
		if (!found && some) {
			// move random ant

			// ...
		}
	}

	fragColor = vec4(
		float(r) / 255.0,
		float(g) / 255.0,
		float(b) / 255.0,
		rgba.a
	);
}
