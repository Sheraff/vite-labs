struct Config {
	width: f32,
	height: f32,
	particleCount: u32,

	// interaction parameters
	repulsionRange: f32,
	attractionRange: f32,
	repulsionStrength: f32,
	attractionStrength: f32,

	// binning info
	binWidth: f32,
	binHeight: f32,
	widthDivisions: u32,
	heightDivisions: u32,
}

@group(0) @binding(0) var<uniform> dt: f32;

@group(1) @binding(0) var<storage, read_write> particlePositions: array<vec2f>;
@group(1) @binding(1) var<storage, read_write> particleVelocities: array<vec2f>;
@group(1) @binding(2) var<storage, read> particleColors: array<u32>;

@group(2) @binding(0) var<uniform> config: Config;
@group(2) @binding(1) var<storage> interactions: array<f32>;

@group(3) @binding(0) var<storage, read> binSize: array<u32>;
@group(3) @binding(1) var<storage, read> binOffset: array<u32>;
@group(3) @binding(2) var<storage, read> binContents: array<u32>;

const COLOR_COUNT = 6u;

@compute @workgroup_size(64)
fn update(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.particleCount) {
		return;
	}

	var position = particlePositions[i];
	var velocity = particleVelocities[i];
	let color = particleColors[i];

	let range = config.repulsionRange + config.attractionRange;

	let min_bin_x = u32((position.x - range) * config.binWidth);
	let min_bin_y = u32((position.y - range) * config.binHeight);
	let max_bin_x = u32((position.x + range) * config.binWidth);
	let max_bin_y = u32((position.y + range) * config.binHeight);

	let wd = config.widthDivisions;
	let hd = config.heightDivisions;

	let half_width = config.width / 2.0;
	let half_height = config.height / 2.0;

	let repulsion_range = config.repulsionRange;
	let pre_mult_repulsion_strength = config.repulsionStrength * dt / repulsion_range;
	let pre_mult_attraction_strength = config.attractionStrength * dt;
	let pre_mult_inv_attraction_range = 1 / config.attractionRange;

	for (var bin_x = min_bin_x; bin_x <= max_bin_x; bin_x++) {
		let wrapped_bin_x = (bin_x + wd) % wd;
		for (var bin_y = min_bin_y; bin_y <= max_bin_y; bin_y++) {
			let wrapped_bin_y = (bin_y + hd) % hd;
			let bin_index = wrapped_bin_y * wd + wrapped_bin_x;

			let bin_start = binOffset[bin_index];
			let bin_size = binSize[bin_index];
			let bin_end = bin_start + bin_size;

			for (var j = bin_start; j < bin_end; j++) {
				let other_index = binContents[j];
				if (other_index == i) {
					continue;
				}

				let other_position = particlePositions[other_index];
				
				// wrapped distance
				var offset = other_position - position;
				if (offset.x > half_width) {
					offset.x -= config.width;
				} else if (offset.x < -half_width) {
					offset.x += config.width;
				}
				if (offset.y > half_height) {
					offset.y -= config.height;
				} else if (offset.y < -half_height) {
					offset.y += config.height;
				}

				let dist = length(offset);

				if (dist < repulsion_range) {
					// Repulsion
					let strength = (repulsion_range - dist) * pre_mult_repulsion_strength;
					velocity -= normalize(offset) * strength;
				} else if (dist < range) {
					// Attraction
					let other_color = particleColors[other_index];
					let interaction_index = color * COLOR_COUNT + other_color;
					let interaction_strength = interactions[interaction_index];
					let normalized_distance = 1 - (dist - repulsion_range) * pre_mult_inv_attraction_range;
					let symmetric_distance = 1.0 - abs(normalized_distance * 2.0 - 1.0);
					let strength = symmetric_distance * interaction_strength * pre_mult_attraction_strength;
					velocity += normalize(offset) * strength;
				}
			}
		}
	}

	// dampen velocity
	velocity -= vec2f(velocity.x * velocity.x * sign(velocity.x), velocity.y * velocity.y * sign(velocity.y)) * 0.2 * dt;

	// update position
	position += velocity * dt;

	// wrap around edges
	if (position.x < 0.0) {
		position.x += config.width;
	}
	if (position.x >= config.width) {
		position.x -= config.width;
	}
	if (position.y < 0.0) {
		position.y += config.height;
	}
	if (position.y >= config.height) {
		position.y -= config.height;
	}

	particlePositions[i] = position;
	particleVelocities[i] = velocity;
}