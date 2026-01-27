// 2D spatial binning with z distance checked separately
struct Config {
	width: f32,
	height: f32,
	depth: f32,
	boidCount: u32,
	// Boids parameters
	visionRange: f32,
	separationRange: f32,
	separationStrength: f32,
	alignmentStrength: f32,
	cohesionStrength: f32,
	maxSpeed: f32,
	minSpeed: f32,
	// Binning info (2D)
	binWidth: f32,
	binHeight: f32,
	widthDivisions: u32,
	heightDivisions: u32,
}

@group(0) @binding(0) var<uniform> dt: f32;

@group(1) @binding(0) var<storage, read_write> boidPositions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> boidVelocities: array<vec4f>;

@group(2) @binding(0) var<uniform> config: Config;

@group(3) @binding(0) var<storage, read> binSize: array<u32>;
@group(3) @binding(1) var<storage, read> binOffset: array<u32>;
@group(3) @binding(2) var<storage, read> binContents: array<u32>;

@compute @workgroup_size(64)
fn update(
	@builtin(global_invocation_id) id: vec3u,
) {
	let i = id.x;
	if (i >= config.boidCount) {
		return;
	}

	var position = boidPositions[i].xyz;
	var velocity = boidVelocities[i].xyz;

	let visionRange = config.visionRange;
	let separationRange = config.separationRange;
	let visionRangeSq = visionRange * visionRange;
	let separationRangeSq = separationRange * separationRange;
	
	// Calculate 2D bin range to search
	let min_bin_x = u32(max(0.0, (position.x - visionRange) * config.binWidth));
	let min_bin_y = u32(max(0.0, (position.y - visionRange) * config.binHeight));
	let max_bin_x = u32(min(f32(config.widthDivisions - 1u), (position.x + visionRange) * config.binWidth));
	let max_bin_y = u32(min(f32(config.heightDivisions - 1u), (position.y + visionRange) * config.binHeight));

	let wd = config.widthDivisions;

	// Accumulators for boid rules
	var separationForce = vec3f(0.0);
	var alignmentSum = vec3f(0.0);
	var cohesionSum = vec3f(0.0);
	var neighborCount = 0u;
	var separationCount = 0u;

	// Search neighboring bins (2D)
	for (var bin_y = min_bin_y; bin_y <= max_bin_y; bin_y++) {
		for (var bin_x = min_bin_x; bin_x <= max_bin_x; bin_x++) {
			let bin_index = bin_y * wd + bin_x;

			let bin_start = binOffset[bin_index];
			let bin_count = binSize[bin_index];
			let bin_end = bin_start + bin_count;

			for (var j = bin_start; j < bin_end; j++) {
				let other_index = binContents[j];
				if (other_index == i) {
					continue;
				}

				let other_position = boidPositions[other_index].xyz;
				let other_velocity = boidVelocities[other_index].xyz;
				
				let offset = other_position - position;
				let distSq = dot(offset, offset);

				if (distSq < 0.001) {
					continue;
				}

				// Separation: steer away from nearby boids
				if (distSq < separationRangeSq) {
					let dist = sqrt(distSq);
					let repelStrength = (separationRange - dist) / separationRange;
					separationForce -= offset / dist * repelStrength;
					separationCount++;
				}

				// Alignment and Cohesion: only for boids within vision range
				if (distSq < visionRangeSq) {
					alignmentSum += other_velocity;
					cohesionSum += other_position;
					neighborCount++;
				}
			}
		}
	}

	// Apply separation force
	if (separationCount > 0u) {
		velocity += separationForce * config.separationStrength * dt;
	}

	// Apply alignment: steer towards average heading of neighbors
	if (neighborCount > 0u) {
		let avgVelocity = alignmentSum / f32(neighborCount);
		let alignmentForce = avgVelocity - velocity;
		velocity += alignmentForce * config.alignmentStrength * dt;

		// Apply cohesion: steer towards center of mass of neighbors
		let avgPosition = cohesionSum / f32(neighborCount);
		let cohesionForce = avgPosition - position;
		let cohesionDist = length(cohesionForce);
		if (cohesionDist > 0.001) {
			velocity += (cohesionForce / cohesionDist) * config.cohesionStrength * dt;
		}
	}

	// Clamp speed
	let speed = length(velocity);
	if (speed > config.maxSpeed) {
		velocity = normalize(velocity) * config.maxSpeed;
	} else if (speed < config.minSpeed && speed > 0.001) {
		velocity = normalize(velocity) * config.minSpeed;
	}

	// Update position
	position += velocity * dt;

	// Wrap around edges (x and y only)
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
	// Bounce on z axis
	if (position.z < 0.0) {
		position.z = -position.z;
		velocity.z = -velocity.z;
	}
	if (position.z >= config.depth) {
		position.z = 2.0 * config.depth - position.z;
		velocity.z = -velocity.z;
	}

	boidPositions[i] = vec4f(position, 0.0);
	boidVelocities[i] = vec4f(velocity, length(velocity));
}
