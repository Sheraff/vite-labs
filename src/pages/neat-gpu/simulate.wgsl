// Simulation compute shader for NEAT-GPU
// Runs neural network simulation and fitness evaluation for entire population

struct Config {
	population: u32,
	foodCount: u32,
	worldSize: f32,
	maxNodes: u32,
	maxGenes: u32,
	iterations: u32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read> genomes: array<f32>; // population * maxGenes * 4
@group(0) @binding(2) var<storage, read> foodPositions: array<vec2f>; // foodCount
@group(0) @binding(3) var<storage, read_write> fitness: array<f32>; // population

const PI = 3.14159265359;
const MAX_WEIGHT = 255.0;
const INNATE_NODES = 9u;
const VISION_DISTANCE = 20.0;
const EATING_DISTANCE = 3.0;

// Activation functions (28 total)
fn activation(x: f32, activationType: u32) -> f32 {
	switch activationType {
		case 0u: { return x; } // identity
		case 1u: { return -x; } // opposite
		case 2u: { return abs(x); } // abs
		case 3u: { return clamp(x, -1.0, 1.0); } // clamped
		case 4u: { return x * x * x; } // cube
		case 5u: { return exp(x); } // exp
		case 6u: { return exp(-(x * x)); } // gauss
		case 7u: { return max(0.0, select(1.0 - x, 1.0 + x, x < 0.0)); } // hat
		case 8u: { return select(1.0 / x, 0.0, x == 0.0); } // inv
		case 9u: { return select(log(x), 0.0, x <= 0.0); } // log
		case 10u: { return max(0.0, x); } // relu
		case 11u: { return select(exp(x) - 1.0, x, x >= 0.0); } // elu
		case 12u: { return select(0.01 * x, x, x >= 0.0); } // lelu
		case 13u: { return 1.0507 * select(1.67326 * (exp(x) - 1.0), x, x >= 0.0); } // selu
		case 14u: { return 1.0 / (1.0 + exp(-x)); } // sigmoid
		case 15u: { return sin(x); } // sin
		case 16u: { return log(1.0 + exp(x)); } // softplus
		case 17u: { return x * x; } // square
		case 18u: { return tanh(x); } // tanh
		case 19u: { return select(1.0, 0.0, x < 0.0); } // binary
		case 20u: { return x / (1.0 + exp(-x)); } // swish
		case 21u: { return x * tanh(log(1.0 + exp(x))); } // mish
		case 22u: { return x / (1.0 + abs(x)); } // softsign
		case 23u: { return (sqrt(x * x + 1.0) - 1.0) / 2.0 + x; } // bentid
		case 24u: { return select(sin(x) / x, 1.0, x == 0.0); } // sinc
		case 25u: { return 0.5 * x * (1.0 + tanh(sqrt(2.0 / PI) * (x + 0.044715 * x * x * x))); } // gelu
		case 26u: { return clamp(x, -1.0, 1.0); } // hardtanh
		case 27u: { return clamp(0.2 * x + 0.5, 0.0, 1.0); } // hardsig
		case 28u: { return select(1.0, 0.0, x < 0.0); } // step
		default: { return x; }
	}
}

// Aggregation functions - simplified for GPU (using common ones)
fn aggregate(values: ptr<function, array<f32, 64>>, count: u32, aggregationType: u32) -> f32 {
	if (count == 0u) { return 0.0; }
	
	switch aggregationType {
		case 0u: { // sum
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (*values)[i];
			}
			return result;
		}
		case 1u: { // mean
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (*values)[i];
			}
			return result / f32(count);
		}
		case 2u: { // product
			var result = 1.0;
			for (var i = 0u; i < count; i++) {
				result *= (*values)[i];
			}
			return result;
		}
		case 3u: { // max
			var result = (*values)[0];
			for (var i = 1u; i < count; i++) {
				result = max(result, (*values)[i]);
			}
			return result;
		}
		case 4u: { // min
			var result = (*values)[0];
			for (var i = 1u; i < count; i++) {
				result = min(result, (*values)[i]);
			}
			return result;
		}
		case 5u: { // maxabs
			var result = abs((*values)[0]);
			for (var i = 1u; i < count; i++) {
				result = max(result, abs((*values)[i]));
			}
			return result;
		}
		case 6u: { // median - simplified to mean for GPU
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += abs((*values)[i]);
			}
			return result / f32(count);
		}
		case 7u: { // medianabs - simplified to mean for GPU
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += abs((*values)[i]);
			}
			return result / f32(count);
		}
		case 8u: { // mode - simplified to mean
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (*values)[i];
			}
			return result / f32(count);
		}
		case 9u: { // modeabs - simplified to mean
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (*values)[i];
			}
			return result / f32(count);
		}
		case 10u: { // variance
			if (count <= 1u) { return 0.0; }
			var mean = 0.0;
			for (var i = 0u; i < count; i++) {
				mean += (*values)[i];
			}
			mean /= f32(count);
			var variance = 0.0;
			for (var i = 0u; i < count; i++) {
				let diff = (*values)[i] - mean;
				variance += diff * diff;
			}
			return variance / f32(count);
		}
		case 11u: { // stddev
			if (count <= 1u) { return 0.0; }
			var mean = 0.0;
			for (var i = 0u; i < count; i++) {
				mean += (*values)[i];
			}
			mean /= f32(count);
			var variance = 0.0;
			for (var i = 0u; i < count; i++) {
				let diff = (*values)[i] - mean;
				variance += diff * diff;
			}
			return sqrt(variance / f32(count));
		}
		case 12u: { // rms
			var sum = 0.0;
			for (var i = 0u; i < count; i++) {
				sum += (*values)[i] * (*values)[i];
			}
			return sqrt(sum / f32(count));
		}
		case 13u: { // range
			var minVal = (*values)[0];
			var maxVal = (*values)[0];
			for (var i = 1u; i < count; i++) {
				minVal = min(minVal, (*values)[i]);
				maxVal = max(maxVal, (*values)[i]);
			}
			return maxVal - minVal;
		}
		case 14u: { // geometric_mean - simplified
			var product = 1.0;
			for (var i = 0u; i < count; i++) {
				if ((*values)[i] > 0.0) {
					product *= (*values)[i];
				}
			}
			return pow(product, 1.0 / f32(count));
		}
		case 15u: { // harmonic_mean
			var sum = 0.0;
			var validCount = 0u;
			for (var i = 0u; i < count; i++) {
				if ((*values)[i] != 0.0) {
					sum += 1.0 / (*values)[i];
					validCount++;
				}
			}
			if (validCount == 0u) { return 0.0; }
			return f32(validCount) / sum;
		}
		case 16u: { // top2
			if (count == 0u) { return 0.0; }
			if (count == 1u) { return (*values)[0]; }
			var max1 = (*values)[0];
			var max2 = (*values)[1];
			if (max2 > max1) {
				let temp = max1;
				max1 = max2;
				max2 = temp;
			}
			for (var i = 2u; i < count; i++) {
				if ((*values)[i] > max1) {
					max2 = max1;
					max1 = (*values)[i];
				} else if ((*values)[i] > max2) {
					max2 = (*values)[i];
				}
			}
			return max1 + max2;
		}
		case 17u: { // softmax_sum
			var maxVal = (*values)[0];
			for (var i = 1u; i < count; i++) {
				maxVal = max(maxVal, (*values)[i]);
			}
			var sumExp = 0.0;
			for (var i = 0u; i < count; i++) {
				sumExp += exp((*values)[i] - maxVal);
			}
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (exp((*values)[i] - maxVal) / sumExp) * (*values)[i];
			}
			return result;
		}
		default: { // fallback to sum
			var result = 0.0;
			for (var i = 0u; i < count; i++) {
				result += (*values)[i];
			}
			return result;
		}
	}
}

fn processNode(
	genomeOffset: u32,
	nodeIdx: u32,
	nodeAggr: u32,
	nodeActiv: u32,
	memory: ptr<function, array<f32, 39>>,
	current: ptr<function, array<f32, 39>>
) {
	// Collect incoming connections for this node
	var incomingValues: array<f32, 64>;
	var incomingCount = 0u;
	
	for (var g = 0u; g < config.maxGenes; g++) {
		let geneIdx = genomeOffset + g * 4u;
		if (u32(genomes[geneIdx]) == 2u) { // Connection gene
			let toNode = u32(genomes[geneIdx + 2u]);
			if (toNode == nodeIdx && incomingCount < 64u) {
				let weight = genomes[geneIdx + 3u];
				let fromNode = u32(genomes[geneIdx + 1u]);
				incomingValues[incomingCount] = (*memory)[fromNode] * (weight / MAX_WEIGHT);
				incomingCount++;
			}
		}
	}
	
	// Apply aggregation and activation
	if (incomingCount > 0u) {
		let aggregated = aggregate(&incomingValues, incomingCount, nodeAggr);
		(*current)[nodeIdx] = activation(aggregated, nodeActiv);
	}
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
	let entityId = id.x;
	if (entityId >= config.population) { return; }
	
	// Initialize local state
	var x = config.worldSize / 2.0;
	var y = config.worldSize / 2.0;
	var angle = 0.0;
	var alive = true;
	var score = 0.0;
	var total_distance = 0.0;
	
	// Initialize local neural network buffers
	var memory: array<f32, 39>;
	var current: array<f32, 39>;
	
	// Initialize eaten food bitset (300 food / 32 bits = 10 u32s needed)
	var eatenFood: array<u32, 10>;
	
	// Loop over all iterations
	for (var iter = 0u; iter < config.iterations; iter++) {
		// Check boundaries
		if (x < 0.0 || x > config.worldSize || y < 0.0 || y > config.worldSize) {
			alive = false;
			break;
		}
	
		// Wrap angle
		if (angle < 0.0) {
			angle = -(-(angle) % (2.0 * PI)) + 2.0 * PI;
		}
		if (angle > 2.0 * PI) {
			angle = angle % (2.0 * PI);
		}
		
		// Detect walls
		let wallAngle = -angle + PI / 2.0;
		var has_wall_ahead = false;
		var has_wall_left = false;
		var has_wall_right = false;
		
		let ahead_x = x + sin(wallAngle) * VISION_DISTANCE;
		let ahead_y = y + cos(wallAngle) * VISION_DISTANCE;
		has_wall_ahead = ahead_x < 0.0 || ahead_x > config.worldSize || ahead_y < 0.0 || ahead_y > config.worldSize;
		
		if (!has_wall_ahead) {
			let left_x = x + sin(wallAngle + PI / 2.0) * VISION_DISTANCE;
			let left_y = y + cos(wallAngle + PI / 2.0) * VISION_DISTANCE;
			has_wall_left = left_x < 0.0 || left_x > config.worldSize || left_y < 0.0 || left_y > config.worldSize;
			
			let right_x = x + sin(wallAngle - PI / 2.0) * VISION_DISTANCE;
			let right_y = y + cos(wallAngle - PI / 2.0) * VISION_DISTANCE;
			has_wall_right = right_x < 0.0 || right_x > config.worldSize || right_y < 0.0 || right_y > config.worldSize;
		}
		
		// Detect food
		var has_food_ahead = false;
		var has_food_left = false;
		var has_food_right = false;
		
		for (var f = 0u; f < config.foodCount; f++) {
			// Check if food already eaten (using bitset)
			let bitIndex = f;
			let arrayIndex = bitIndex / 32u;
			let bitOffset = bitIndex % 32u;
			let eaten = (eatenFood[arrayIndex] & (1u << bitOffset)) != 0u;
			
			if (eaten) { continue; }
			
			let food = foodPositions[f];
			let distance = length(vec2f(x, y) - food);
			
			if (distance < EATING_DISTANCE) {
				score += 100.0;
				// Mark as eaten
				eatenFood[arrayIndex] |= (1u << bitOffset);
			} else if (distance < VISION_DISTANCE) {
				// Calculate angle from entity to food
				let foodAngle = atan2(food.y - y, food.x - x);
				// Calculate relative angle (difference from entity's heading)
				var relativeAngle = foodAngle - angle;
				// Normalize to [-PI, PI]
				if (relativeAngle > PI) {
					relativeAngle -= 2.0 * PI;
				}
				if (relativeAngle < -PI) {
					relativeAngle += 2.0 * PI;
				}
				
				// Check if food is within vision cone (±36 degrees)
				let visionAngle = PI / 3.0;
				if (abs(relativeAngle) < visionAngle) {
					// Determine if food is left, ahead, or right
					if (abs(relativeAngle) < visionAngle / 3.0) {
						has_food_ahead = true;
					} else if (relativeAngle < 0.0) {
						has_food_left = true;
					} else {
						has_food_right = true;
					}
				}
			}
		}
		
		// Execute neural network
		// Clear current buffer and set inputs
		for (var i = 0u; i < config.maxNodes; i++) {
			current[i] = 0.0;
		}
		
		// Set input nodes
		current[0u] = select(0.0, 1.0, has_food_left);
		current[1u] = select(0.0, 1.0, has_food_ahead);
		current[2u] = select(0.0, 1.0, has_food_right);
		current[3u] = select(0.0, 1.0, has_wall_left);
		current[4u] = select(0.0, 1.0, has_wall_ahead);
		current[5u] = select(0.0, 1.0, has_wall_right);
		
		memory[0u] = current[0u];
		memory[1u] = current[1u];
		memory[2u] = current[2u];
		memory[3u] = current[3u];
		memory[4u] = current[4u];
		memory[5u] = current[5u];
		
		// Process genome to execute neural network
		let genomeOffset = entityId * config.maxGenes * 4u;
		
		// Process each gene
		for (var i = 0u; i < config.maxGenes; i++) {
			let geneIdx = genomeOffset + i * 4u;
			
			if (u32(genomes[geneIdx]) != 1u) { continue; } // not a Node gene
			let nodeIdx = u32(genomes[geneIdx + 1u]);
			let nodeAggr = u32(genomes[geneIdx + 2u]);
			let nodeActiv = u32(genomes[geneIdx + 3u]);
			
			processNode(
				genomeOffset,
				nodeIdx,
				nodeAggr,
				nodeActiv,
				&memory,
				&current
			);
		}

		// process output nodes (6,7,8) that don't have a gene
		for (var outputIdx = 6u; outputIdx < INNATE_NODES; outputIdx++) {
			processNode(
				genomeOffset,
				outputIdx,
				0u, // sum aggregation
				0u,  // identity activation
				&memory,
				&current
			);
		}
		
		// Copy current to memory
		for (var i = 0u; i < config.maxNodes; i++) {
			memory[i] = current[i];
		}
		
		// Read outputs and update state
		let rotate_left = max(0.0, min(current[6u], 10.0));
		let rotate_right = max(0.0, min(current[7u], 10.0));
		let rotate = rotate_right - rotate_left;
		let delta = 1000.0 / 120.0; // Fixed timestep: 8.333333ms
		angle += (rotate / 100.0) * (delta / 10.0);
		
		let speed = min(4.0, max(0.0, current[8u]));
		if (speed > 0.0) {
			let prevX = x;
			let prevY = y;
			x += cos(angle) * speed * (delta / 100.0);
			y += sin(angle) * speed * (delta / 100.0);
			total_distance += length(vec2f(x - prevX, y - prevY));
		}
	
		// Continue iteration loop
	}
	
	// Compute and write fitness
	var final_fitness = 0.0;
	if (alive) {
		final_fitness = score + total_distance / 10.0;
		final_fitness /= f32(config.iterations) * f32(config.foodCount) * f32(config.worldSize) / 10000000.0; // Normalize
	}
	fitness[entityId] = final_fitness;
}
