struct Config {
	width: f32,
	height: f32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(1) @binding(0) var<storage, read> particlePositions: array<vec2f>;
@group(1) @binding(1) var<storage, read> particleColors: array<u32>;

const size = 2.0;
const positions = array<vec2f, 6>(
	vec2f(-1, -1),
	vec2f( 1, -1),
	vec2f( 1,  1),
	vec2f(-1, -1),
	vec2f( 1,  1),
	vec2f(-1,  1),
);

const colors = array<vec4f, 8>(
	vec4f(0.72, 0.07, 0.02, 1.0), // red
	vec4f(0.12, 0.67, 0.89, 1.0), // cyan
	vec4f(0.84, 1.0, 0.19, 1.0), // yellow
	vec4f(0.53, 0.05, 0.87, 1.0), // indigo
	vec4f(0.04, 0.56, 0.04, 1.0), // green
	vec4f(0.56, 0.56, 0.77, 1.0), // lavender
	vec4f(1.0, 0.65, 0.0, 1.0), // orange
	vec4f(0.93, 0.51, 0.93, 1.0), // violet
);

struct VertexOutput {
	// corner of the square (clip space)
	@builtin(position) position: vec4f,
	// color of the particle
	@location(1) color: vec4f,
	// offset from center (for fragment shader)
	@location(0) offset: vec2f,
}


// for each particle, draw a square centered at its position (i.e. 6 vertices per particle to make a square)
@vertex fn vs(
	@builtin(vertex_index) vertexID: u32,
	@builtin(instance_index) instanceID: u32
) -> VertexOutput {
	let pos = particlePositions[instanceID]; // screen space
	let offset = positions[vertexID];
	let vertex_pos = pos + offset * size; // screen space
	let clip_vertex_pos = vec4f(
		(vertex_pos.x / (config.width / 2.0)) - 1.0,
		-((vertex_pos.y / (config.height / 2.0)) - 1.0),
		0.0,
		1.0
	);
	let color = colors[particleColors[instanceID]];
	return VertexOutput(clip_vertex_pos, color, offset);
}

// paint a circle centered at offset
@fragment fn fs(data: VertexOutput) -> @location(0) vec4f {
	let dist = length(data.offset);
	if (dist > 1.0) {
		discard;
	}
	let alpha = 1.0 - smoothstep(0.6, 1.0, dist);
	return vec4f(data.color.rgb, data.color.a * alpha);
}