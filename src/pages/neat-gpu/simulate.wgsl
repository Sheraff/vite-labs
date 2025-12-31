// Simulation compute shader for NEAT-GPU
// Runs neural network simulation and fitness evaluation for entire population

struct Config {
	population: u32,
	foodCount: u32,
	worldSize: f32,
	maxNodes: u32,
	maxGenes: u32,
	iteration: u32,
}

struct EntityState {
	x: f32,
	y: f32,
	angle: f32,
	alive: f32, // 1.0 = alive, 0.0 = dead
	score: f32,
	distance: f32,
	initialX: f32,
	initialY: f32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read> genomes: array<f32>; // population * maxGenes * 4
@group(0) @binding(2) var<storage, read_write> states: array<EntityState>;
@group(0) @binding(3) var<storage, read_write> memory: array<f32>; // population * maxNodes
@group(0) @binding(4) var<storage, read_write> current: array<f32>; // population * maxNodes
@group(0) @binding(5) var<storage, read> foodPositions: array<vec2f>; // foodCount
@group(0) @binding(6) var<storage, read_write> eatenFood: array<u32>; // population * foodCount (bitset)

const PI = 3.14159265359;
const MAX_WEIGHT = 255.0;
const INNATE_NODES = 9u;
const VISION_DISTANCE = 20.0;

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

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
	let entityId = id.x;
	if (entityId >= config.population) { return; }
	
	// Get entity state
	var state = states[entityId];
	if (state.alive == 0.0) { return; }
	
	// Check boundaries
	if (state.x < 0.0 || state.x > config.worldSize || state.y < 0.0 || state.y > config.worldSize) {
		state.alive = 0.0;
		states[entityId] = state;
		return;
	}
	
	// Wrap angle
	if (state.angle < 0.0) {
		state.angle = -(-state.angle % (2.0 * PI)) + 2.0 * PI;
	}
	if (state.angle > 2.0 * PI) {
		state.angle = state.angle % (2.0 * PI);
	}
	
	// Detect walls
	let angle = -state.angle + PI / 2.0;
	var has_wall_ahead = false;
	var has_wall_left = false;
	var has_wall_right = false;
	
	let ahead_x = state.x + sin(angle) * VISION_DISTANCE;
	let ahead_y = state.y + cos(angle) * VISION_DISTANCE;
	has_wall_ahead = ahead_x < 0.0 || ahead_x > config.worldSize || ahead_y < 0.0 || ahead_y > config.worldSize;
	
	if (!has_wall_ahead) {
		let left_x = state.x + sin(angle + PI / 2.0) * VISION_DISTANCE;
		let left_y = state.y + cos(angle + PI / 2.0) * VISION_DISTANCE;
		has_wall_left = left_x < 0.0 || left_x > config.worldSize || left_y < 0.0 || left_y > config.worldSize;
		
		let right_x = state.x + sin(angle - PI / 2.0) * VISION_DISTANCE;
		let right_y = state.y + cos(angle - PI / 2.0) * VISION_DISTANCE;
		has_wall_right = right_x < 0.0 || right_x > config.worldSize || right_y < 0.0 || right_y > config.worldSize;
	}
	
	// Detect food
	var has_food_ahead = false;
	var has_food_left = false;
	var has_food_right = false;
	
	for (var f = 0u; f < config.foodCount; f++) {
		// Check if food already eaten (using bitset)
		let bitIndex = entityId * config.foodCount + f;
		let arrayIndex = bitIndex / 32u;
		let bitOffset = bitIndex % 32u;
		let eaten = (eatenFood[arrayIndex] & (1u << bitOffset)) != 0u;
		
		if (eaten) { continue; }
		
		let food = foodPositions[f];
		let distance = length(vec2f(state.x, state.y) - food);
		
		if (distance < 5.0) {
			state.score += 100.0;
			// Mark as eaten
			eatenFood[arrayIndex] |= (1u << bitOffset);
		} else if (distance < VISION_DISTANCE) {
			// Calculate angle from entity to food
			let foodAngle = atan2(food.y - state.y, food.x - state.x);
			// Calculate relative angle (difference from entity's heading)
			var relativeAngle = foodAngle - state.angle;
			// Normalize to [-PI, PI]
			if (relativeAngle > PI) {
				relativeAngle -= 2.0 * PI;
			}
			if (relativeAngle < -PI) {
				relativeAngle += 2.0 * PI;
			}
			
			// Check if food is within vision cone (±36 degrees)
			let visionAngle = PI / 5.0;
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
	let memOffset = entityId * config.maxNodes;
	let currOffset = entityId * config.maxNodes;
	
	// Clear current buffer and set inputs
	for (var i = 0u; i < config.maxNodes; i++) {
		current[currOffset + i] = 0.0;
	}
	
	// Set input nodes
	current[currOffset + 0u] = select(0.0, 1.0, has_food_left);
	current[currOffset + 1u] = select(0.0, 1.0, has_food_ahead);
	current[currOffset + 2u] = select(0.0, 1.0, has_food_right);
	current[currOffset + 3u] = select(0.0, 1.0, has_wall_left);
	current[currOffset + 4u] = select(0.0, 1.0, has_wall_ahead);
	current[currOffset + 5u] = select(0.0, 1.0, has_wall_right);
	
	memory[memOffset + 0u] = current[currOffset + 0u];
	memory[memOffset + 1u] = current[currOffset + 1u];
	memory[memOffset + 2u] = current[currOffset + 2u];
	memory[memOffset + 3u] = current[currOffset + 3u];
	memory[memOffset + 4u] = current[currOffset + 4u];
	memory[memOffset + 5u] = current[currOffset + 5u];
	
	// Process genome to execute neural network
	let genomeOffset = entityId * config.maxGenes * 4u;
	
	// First pass: process all nodes
	for (var nodeIdx = 0u; nodeIdx < config.maxNodes; nodeIdx++) {
		// Find node definition in genome
		var nodeAggr = 0u;
		var nodeActiv = 0u;
		var foundNode = false;
		
		for (var g = 0u; g < config.maxGenes; g++) {
			let geneType = u32(genomes[genomeOffset + g * 4u]);
			if (geneType == 1u) { // Node gene
				let nodeIndex = u32(genomes[genomeOffset + g * 4u + 1u]);
				if (nodeIndex == nodeIdx) {
					nodeAggr = u32(genomes[genomeOffset + g * 4u + 2u]);
					nodeActiv = u32(genomes[genomeOffset + g * 4u + 3u]);
					foundNode = true;
					break;
				}
			}
		}
		
		if (!foundNode && nodeIdx >= INNATE_NODES) { continue; }
		
		// Collect incoming connections
		var incomingValues: array<f32, 64>;
		var incomingCount = 0u;
		
		for (var g = 0u; g < config.maxGenes; g++) {
			let geneType = u32(genomes[genomeOffset + g * 4u]);
			if (geneType == 2u) { // Connection gene
				let fromNode = u32(genomes[genomeOffset + g * 4u + 1u]);
				let toNode = u32(genomes[genomeOffset + g * 4u + 2u]);
				let weight = genomes[genomeOffset + g * 4u + 3u];
				
				if (toNode == nodeIdx && incomingCount < 64u) {
					incomingValues[incomingCount] = memory[memOffset + fromNode] * (weight / MAX_WEIGHT);
					incomingCount++;
				}
			}
		}
		
		// Apply aggregation and activation
		if (incomingCount > 0u) {
			let aggregated = aggregate(&incomingValues, incomingCount, nodeAggr);
			current[currOffset + nodeIdx] = activation(aggregated, nodeActiv);
		}
	}
	
	// Copy current to memory
	for (var i = 0u; i < config.maxNodes; i++) {
		memory[memOffset + i] = current[currOffset + i];
	}
	
	// Read outputs and update state
	let rotate_left = max(0.0, min(current[currOffset + 6u], 10.0));
	let rotate_right = max(0.0, min(current[currOffset + 7u], 10.0));
	let rotate = rotate_right - rotate_left;
	let delta = 1000.0 / 120.0; // Fixed timestep: 8.333333ms
	state.angle += (rotate / 100.0) * (delta / 10.0);
	
	let speed = min(4.0, max(0.0, current[currOffset + 8u]));
	if (speed > 0.0) {
		let prevX = state.x;
		let prevY = state.y;
		state.x += cos(state.angle) * speed * (delta / 100.0);
		state.y += sin(state.angle) * speed * (delta / 100.0);
		state.distance += length(vec2f(state.x - prevX, state.y - prevY));
	}
	
	// Update state
	states[entityId] = state;
}
