struct Config {
	binWidth: f32,
	binHeight: f32,
	widthDivisions: u32,
	binCount: u32,
	particleCount: u32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(1) @binding(0) var<storage, read_write> binSize: array<atomic<u32>>;
@group(1) @binding(1) var<storage, read_write> binOffset: array<u32>;
@group(1) @binding(2) var<storage, read_write> binCursor: array<atomic<u32>>;
@group(1) @binding(3) var<storage, read_write> binContents: array<u32>;
@group(2) @binding(0) var<storage, read> particlePositions: array<vec2f>;

@compute @workgroup_size(64)
fn clear(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.binCount) {
		return;
	}
	atomicStore(&binSize[i], 0u);
	binOffset[i] = 0u;
	atomicStore(&binCursor[i], 0u);
}

@compute @workgroup_size(64)
fn size(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.particleCount) {
		return;
	}

	let position = particlePositions[i];
	let bin_x = u32(position.x * config.binWidth);
	let bin_y = u32(position.y * config.binHeight);
	let index = bin_y * config.widthDivisions + bin_x;

	atomicAdd(&binSize[index], 1u);
}

@compute @workgroup_size(64)
fn prepare(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.binCount) {
		return;
	}
	var offset = 0u;
	for (var j: u32 = 0u; j < i; j++) {
		offset = offset + atomicLoad(&binSize[j]);
	}
	binOffset[i] = offset;
}

@compute @workgroup_size(64)
fn fill(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.particleCount) {
		return;
	}

	let position = particlePositions[i];
	let bin_x = u32(position.x * config.binWidth);
	let bin_y = u32(position.y * config.binHeight);
	let index = bin_y * config.widthDivisions + bin_x;

	let offset = atomicAdd(&binCursor[index], 1u);
	let writeIndex = binOffset[index] + offset;
	binContents[writeIndex] = i;
}