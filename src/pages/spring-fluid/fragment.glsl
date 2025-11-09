#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D previous_frame;
uniform sampler2D obstacles;
uniform float seed;
uniform float dt; // time step

out vec4 fragColor;

const vec2 top = vec2(0, -1);
const vec2 right = vec2(1, 0);
const vec2 bottom = vec2(0, 1);
const vec2 left = vec2(-1, 0);

uniform float k; // spring constant
uniform float damping; // velocity damping
const float scale = 1.0f; // scale for reading/formatting velocity/offsets
uniform float clamp_value; // clamp max velocity/offsets
uniform float turbulence_factor; // turbulence strength multiplier [0 - 10]

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
	return vec2(pixel.z * 2.0f - 1.0f, pixel.a * 2.0f - 1.0f) * scale;
}

vec2 getVelocity(vec4 pixel) {
	return vec2(pixel.x * 2.0f - 1.0f, pixel.y * 2.0f - 1.0f) * scale;
}

bool isEdgePixel(vec2 coord) {
	if(coord.x <= 1.0f || coord.x >= resolution.x - 1.0f || coord.y <= 1.0f || coord.y >= resolution.y - 1.0f)
		return true;
	if(texture(obstacles, coord / resolution.xy).r > 0.5f)
		return true;
	return false;
}

// random number [0,1] inclusive
float rand(vec2 identity) {
	vec2 seeded = identity + vec2(seed * 0.1f, seed * 0.2f);
	return fract(sin(dot(seeded, vec2(12.9898f, 78.233f))) * 43758.5453f);
}

// A single iteration of Bob Jenkins' One-At-A-Time hashing algorithm for u32.
uint hash_u32(uint x_in) {
	uint x = x_in;
	x += (x << 10u);
	x ^= (x >> 6u);
	x += (x << 3u);
	x ^= (x >> 11u);
	x += (x << 15u);
	return x;
}

// Construct a float with half-open range [0:1] using low 23 bits.
// All zeroes yields 0.0, all ones yields the next smallest representable value below 1.0.
float float_construct_from_u32(uint m_in) {
	uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
	uint ieeeOne = 0x3F800000u;      // 1.0 in IEEE binary32

	uint m = m_in;
	m &= ieeeMantissa;              // Keep only mantissa bits (fractional part)
	m |= ieeeOne;                   // Add fractional part to 1.0

	float f = uintBitsToFloat(m);        // Range [1:2]
	return f - 1.0f;                 // Range [0:1]
}

// Pseudo-random value in half-open range [0:1] from a f32 seed.
// from https://marktension.nl/blog/my_favorite_wgsl_random_func_so_far/
float random_uniform(vec2 identity) {
	float seeded = identity.x * seed * 0.1f + identity.y * seed * 0.2f;
	return float_construct_from_u32(hash_u32(floatBitsToUint(seeded)));
}

vec2 updateForces(vec2 forces, vec2 position, vec2 direction) {
	vec4 neighbor = getPixel(direction);
	vec2 n_offsets = getOffset(neighbor);
	vec2 n_position = vec2(gl_FragCoord.xy + direction + n_offsets);

	float rest_length = length(direction);

	vec2 spring_vec = n_position - position;
	float current_length = length(spring_vec);
	if(current_length > 0.001f) { // avoid division by zero
		vec2 spring_dir = spring_vec / current_length;
		float displacement = current_length - rest_length;

		// Hooke's law: F = -k * displacement
		vec2 spring_force = k * displacement * spring_dir;

		forces += spring_force;
	}

	return forces;
}

vec2 format(vec2 v) {
	return clamp(v / scale * 0.5f + vec2(0.5f), 0.0f, 1.0f);
}

void main() {
	vec4 rgba = getPixel();

	bool isEdge = isEdgePixel(gl_FragCoord.xy);

	if(isEdge) {
		fragColor = vec4(0.5f, 0.5f, 0.5f, 0.5f);
		return;
	}

	vec2 offsets = getOffset(rgba);
	vec2 velocity = getVelocity(rgba);
	vec2 position = vec2(gl_FragCoord.xy + offsets);

	// spring force from neighbors
	vec2 forces = vec2(0.0f, 0.0f);
	forces = updateForces(forces, position, left);
	forces = updateForces(forces, position, right);
	forces = updateForces(forces, position, top);
	forces = updateForces(forces, position, bottom);
	forces = updateForces(forces, position, top + left);
	forces = updateForces(forces, position, top + right);
	forces = updateForces(forces, position, bottom + left);
	forces = updateForces(forces, position, bottom + right);

	// turbulence / noise
	if(turbulence_factor > 0.0f) {
		float turbulence_strength = turbulence_factor * length(velocity);
		float noise = rand(gl_FragCoord.xy);
		vec2 turbulence = vec2(cos(noise * 6.28318f), sin(noise * 6.28318f));
		forces += turbulence * turbulence_strength;
	}

	// velocity
	velocity += forces * dt;
	velocity *= damping;
	if(length(velocity) < clamp_value * scale) {
		velocity = vec2(0.0f, 0.0f);
	}

	// position
	offsets += velocity * dt;
	if(velocity.x == 0.0f && velocity.y == 0.0f && length(offsets) < clamp_value * scale) {
		offsets = vec2(0.0f, 0.0f);
	}

	// clamp
	offsets = format(offsets);
	velocity = format(velocity);

	// output
	fragColor = vec4(velocity, offsets);
}
