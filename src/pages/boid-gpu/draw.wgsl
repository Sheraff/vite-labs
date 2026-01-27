struct Config {
	width: f32,
	height: f32,
	depth: f32,
	padding: f32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(1) @binding(0) var<storage, read> boidPositions: array<vec4f>;
@group(1) @binding(1) var<storage, read> boidVelocities: array<vec4f>;

// Triangle vertices for a boid shape (pointing up in local space)
// We'll rotate this based on velocity direction
const BASE_SIZE = 4.0;
const MIN_SIZE_SCALE = 0.3;
const MAX_SIZE_SCALE = 1.5;

struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) color: vec4f,
	@location(1) barycentric: vec3f,
}

@vertex fn vs(
	@builtin(vertex_index) vertexID: u32,
	@builtin(instance_index) instanceID: u32
) -> VertexOutput {
	let pos = boidPositions[instanceID].xyz;
	let vel = boidVelocities[instanceID].xyz;
	
	// Calculate size based on z position (closer = larger)
	let zNormalized = pos.z / config.depth;
	let sizeScale = mix(MAX_SIZE_SCALE, MIN_SIZE_SCALE, zNormalized);
	let size = BASE_SIZE * sizeScale;
	
	// Get 2D direction from velocity (projected onto xy plane)
	let vel2d = vec2f(vel.x, vel.y);
	let speed2d = length(vel2d);
	var dir = vec2f(1.0, 0.0);
	if (speed2d > 0.001) {
		dir = vel2d / speed2d;
	}
	
	// Perpendicular direction for the triangle base
	let perp = vec2f(-dir.y, dir.x);
	
	// Perspective distortion based on z velocity direction
	// zRatio: -1 = moving toward viewer, +1 = moving away
	let speed3d = length(vel);
	var zRatio = 0.0;
	if (speed3d > 0.001) {
		zRatio = clamp(vel.z / speed3d, -1.0, 1.0);
	}
	
	// Adjust shape based on z direction:
	// Moving toward (zRatio < 0): shorter tip, wider base (top-down view)
	// Moving away (zRatio > 0): longer tip, narrower base (bottom-up view)
	let t = zRatio * 0.5 + 0.5; // 0 to 1
	let tipLength = mix(0.6, 2.5, t);
	let baseWidth = mix(1.0, 0.2, t);
	let baseBack = mix(0.15, 0.8, t);
	
	// Triangle vertices in local space:
	// vertex 0: tip (front)
	// vertex 1: back-left
	// vertex 2: back-right
	var localOffset: vec2f;
	var barycentric: vec3f;
	switch (vertexID) {
		case 0u: {
			localOffset = dir * size * tipLength;
			barycentric = vec3f(1.0, 0.0, 0.0);
		}
		case 1u: {
			localOffset = -dir * size * baseBack + perp * size * baseWidth;
			barycentric = vec3f(0.0, 1.0, 0.0);
		}
		case 2u, default: {
			localOffset = -dir * size * baseBack - perp * size * baseWidth;
			barycentric = vec3f(0.0, 0.0, 1.0);
		}
	}
	
	// Apply offset to position
	let worldPos = pos.xy + localOffset;
	
	// Convert to clip space
	let clipPos = vec4f(
		(worldPos.x / (config.width / 2.0)) - 1.0,
		-((worldPos.y / (config.height / 2.0)) - 1.0),
		zNormalized, // use z for depth testing
		1.0
	);
	
	// Color based on velocity direction and z position
	// Hue from direction, brightness from z
	let angle = atan2(vel.y, vel.x);
	let hue = (angle + 3.14159) / (2.0 * 3.14159); // normalize to 0-1
	let brightness = mix(1.0, 0.4, zNormalized); // closer = brighter
	let saturation = 0.7;
	
	// HSV to RGB
	let h = hue * 6.0;
	let c = saturation * brightness;
	let x = c * (1.0 - abs(h % 2.0 - 1.0));
	let m = brightness - c;
	
	var rgb: vec3f;
	if (h < 1.0) {
		rgb = vec3f(c, x, 0.0);
	} else if (h < 2.0) {
		rgb = vec3f(x, c, 0.0);
	} else if (h < 3.0) {
		rgb = vec3f(0.0, c, x);
	} else if (h < 4.0) {
		rgb = vec3f(0.0, x, c);
	} else if (h < 5.0) {
		rgb = vec3f(x, 0.0, c);
	} else {
		rgb = vec3f(c, 0.0, x);
	}
	rgb = rgb + vec3f(m, m, m);
	
	// Add some alpha variation based on z
	let alpha = mix(1.0, 0.5, zNormalized);
	
	return VertexOutput(clipPos, vec4f(rgb, alpha), barycentric);
}

@fragment fn fs(data: VertexOutput) -> @location(0) vec4f {
	// Simple solid fill with slight edge darkening
	let minBary = min(min(data.barycentric.x, data.barycentric.y), data.barycentric.z);
	let edgeFactor = smoothstep(0.0, 0.1, minBary);
	
	return vec4f(data.color.rgb * mix(0.7, 1.0, edgeFactor), data.color.a);
}
