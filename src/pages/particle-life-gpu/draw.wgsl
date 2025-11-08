struct Config {
	width: f32,
	height: f32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(1) @binding(0) var<storage, read> particlePositions: array<vec2f>;
@group(1) @binding(1) var<storage, read> particleColors: array<u32>;

const size = 1.0;
const positions = array<vec2f, 6>(
	vec2f(-1, -1),
	vec2f( 1, -1),
	vec2f( 1,  1),
	vec2f(-1, -1),
	vec2f( 1,  1),
	vec2f(-1,  1),
);

const colors = array<vec4f, 6>(
	vec4f(1.0, 0.0, 0.0, 1.0), // red
	vec4f(0.0, 1.0, 0.0, 1.0), // green
	vec4f(0.0, 0.0, 1.0, 1.0), // blue
	vec4f(1.0, 1.0, 0.0, 1.0), // yellow
	vec4f(1.0, 0.0, 1.0, 1.0), // magenta
	vec4f(0.0, 1.0, 1.0, 1.0), // cyan
);

struct VertexOutput {
	// corner of the square (clip space)
	@builtin(position) position: vec4f,
	// color of the particle
	@location(1) color: vec4f,
}


// for each particle, draw a square centered at its position (i.e. 6 vertices per particle to make a square)
@vertex fn vs(
	@builtin(instance_index) instanceID: u32
) -> VertexOutput {
	let pos = particlePositions[instanceID]; // screen space
	let vertex_pos = pos; // screen space
	let clip_vertex_pos = vec4f(
		(vertex_pos.x / (config.width / 2.0)) - 1.0,
		-((vertex_pos.y / (config.height / 2.0)) - 1.0),
		0.0,
		1.0
	);
	let color = colors[particleColors[instanceID]];
	return VertexOutput(clip_vertex_pos, color);
}

// paint a circle centered at offset
@fragment fn fs(data: VertexOutput) -> @location(0) vec4f {
	return data.color;
}