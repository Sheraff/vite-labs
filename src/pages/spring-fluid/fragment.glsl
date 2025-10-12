#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D previous_frame;
uniform float seed;
uniform float dt; // time step

out vec4 fragColor;

const vec2 top = vec2(0, -1);
const vec2 right = vec2(1, 0);
const vec2 bottom = vec2(0, 1);
const vec2 left = vec2(-1, 0);

float rest_length = 1.0; // rest length of springs
const float k = 100.0; // spring constant
const float damping = 0.9999; // velocity damping
const float scale = 3.0; // scale for reading/formatting velocity/offsets

/**
 * Each pixel represents one end of 4 springs connected to the neighboring pixels.
 * It is at position (x + dx, y + dy) with velocity (vx, vy).
 *
 * RGBA channels:
 * R: vx velocity (0, 255) -> (-128, 128)
 * G: vy velocity (0, 255) -> (-128, 128)
 * B: dx offset (0, 255) -> (-128, 128)
 * A: dy offset (0, 255) -> (-128, 128)
 */

vec4 getPixel() {
	return texture(previous_frame, gl_FragCoord.xy / resolution.xy);
}
vec4 getPixel(vec2 coord) {
	return texture(previous_frame, (gl_FragCoord.xy + coord) / resolution.xy);
}

vec2 getOffset(vec4 pixel) {
	return vec2(pixel.z * 2.0 - 1.0, pixel.a * 2.0 - 1.0) * scale;
}

vec2 getVelocity(vec4 pixel) {
	return vec2(pixel.x * 2.0 - 1.0, pixel.y * 2.0 - 1.0) * scale;
}

bool isEdgePixel(vec2 coord) {
	return coord.x <= 1.0 || coord.x >= resolution.x - 1.0 || coord.y <= 1.0 || coord.y >= resolution.y - 1.0;
}

vec2 updateForces(vec2 forces, vec2 position, vec2 direction) {
	vec4 neighbor = getPixel(direction);
	vec2 n_offsets = getOffset(neighbor);
	vec2 n_position = vec2(gl_FragCoord.xy + direction + n_offsets);

	vec2 spring_vec = n_position - position;
	float current_length = length(spring_vec);
	if (current_length > 0.001) { // avoid division by zero
		vec2 spring_dir = spring_vec / current_length;
		float displacement = current_length - rest_length;

		// Hooke's law: F = -k * displacement
		vec2 spring_force = k * displacement * spring_dir;

		forces += spring_force;
	}

	return forces;
}

vec2 format(vec2 v) {
	return clamp(v / scale * 0.5 + vec2(0.5), 0.0, 1.0);
}


void main() {
	vec4 rgba = getPixel();

	bool isEdge = isEdgePixel(gl_FragCoord.xy);

	if (isEdge) {
		fragColor = vec4(0.5, 0.5, 0.5, 0.5);
		return;
	}

	vec2 offsets = getOffset(rgba);
	vec2 velocity = getVelocity(rgba);
	vec2 position = vec2(gl_FragCoord.xy + offsets);

	// spring force from neighbors
	vec2 forces = vec2(0.0, 0.0);
	forces = updateForces(forces, position, left);
	forces = updateForces(forces, position, right);
	forces = updateForces(forces, position, top);
	forces = updateForces(forces, position, bottom);

	// velocity
	velocity += forces * dt;
	velocity *= damping;
	if (length(velocity) < 0.01 * scale) {
		velocity = vec2(0.0, 0.0);
	}

	// position
	offsets += velocity * dt;
	if (velocity.x == 0.0 && velocity.y == 0.0 && length(offsets) < 0.01 * scale) {
		offsets = vec2(0.0, 0.0);
	}

	// clamp
	offsets = format(offsets);
	velocity = format(velocity);

	// output
	fragColor = vec4(
		velocity,
		offsets
	);
}
