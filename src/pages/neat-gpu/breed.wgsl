// Breeding compute shader for NEAT-GPU
// Creates new generation through mutations of parent genomes

struct Config {
	population: u32,
	maxGenes: u32,
	parentsCount: u32,
	rngSeed: u32,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<storage, read> parents: array<f32>; // parentsCount * maxGenes * 4
@group(0) @binding(2) var<storage, read_write> offspring: array<f32>; // population * maxGenes * 4

const MAX_WEIGHT = 255.0;
const INNATE_NODES = 9u;
const ACTIVATION_COUNT = 29u;
const AGGREGATION_COUNT = 18u;

// PCG Random Number Generator
struct RngState {
	state: u32,
}

fn pcg_hash(input: u32) -> u32 {
	var state = input * 747796405u + 2891336453u;
	var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
	return (word >> 22u) ^ word;
}

fn rng_next(rng: ptr<function, RngState>) -> u32 {
	(*rng).state = pcg_hash((*rng).state);
	return (*rng).state;
}

fn rng_f32(rng: ptr<function, RngState>) -> f32 {
	return f32(rng_next(rng)) / 4294967295.0;
}

fn rng_u32_range(rng: ptr<function, RngState>, max: u32) -> u32 {
	if (max == 0u) { return 0u; }
	return rng_next(rng) % max;
}

// Count genes of a specific type in genome
fn countGenes(genome: ptr<function, array<f32, 120>>, geneType: u32) -> u32 {
	var count = 0u;
	for (var i = 0u; i < 30u; i++) {
		if (u32((*genome)[i * 4u]) == geneType) {
			count++;
		}
	}
	return count;
}

// Count void genes (type 0)
fn countVoidGenes(genome: ptr<function, array<f32, 120>>) -> u32 {
	return countGenes(genome, 0u);
}

// Find index of nth gene of given type
fn findNthGene(genome: ptr<function, array<f32, 120>>, geneType: u32, n: u32) -> u32 {
	var count = 0u;
	for (var i = 0u; i < 30u; i++) {
		if (u32((*genome)[i * 4u]) == geneType) {
			if (count == n) {
				return i;
			}
			count++;
		}
	}
	return 0u;
}

// Find first void gene index
fn findVoidGene(genome: ptr<function, array<f32, 120>>) -> u32 {
	for (var i = 0u; i < 30u; i++) {
		if (u32((*genome)[i * 4u]) == 0u) {
			return i;
		}
	}
	return 30u; // No void found
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
	let entityId = id.x;
	if (entityId >= config.population) { return; }
	
	// Initialize RNG with seed + entity ID
	var rng: RngState;
	rng.state = config.rngSeed + entityId;
	
	// Select parent
	let parentId = entityId % config.parentsCount;
	let parentOffset = parentId * config.maxGenes * 4u;
	let offspringOffset = entityId * config.maxGenes * 4u;
	
	// Copy parent genome to offspring
	var genome: array<f32, 120>; // max 30 genes * 4 elements
	for (var i = 0u; i < 120u; i++) {
		genome[i] = parents[parentOffset + i];
	}

	// Only apply mutations if not an elite (first parentsCount entities are elite)
	if (entityId >= config.parentsCount) {
		// Apply mutations
		let mutationType = rng_f32(&rng);
		
		// Count current genes
		let voidCount = countVoidGenes(&genome);
		let nodeCount = countGenes(&genome, 1u);
		let connCount = countGenes(&genome, 2u);

		let probabilities = array<f32, 9>(
			0.1, // Add node
			0.1, // Remove node
			0.2, // Add connection
			0.1, // Remove connection
			0.1, // Change node aggregation
			0.1, // Change node activation
			0.1, // Change connection from
			0.1, // Change connection to
			0.1  // Change connection weight
		);

		let conditions = array<u32, 9>(
			u32(voidCount > 0u), // Add node
			u32(nodeCount > 0u), // Remove node
			u32(voidCount > 0u), // Add connection
			u32(connCount > 0u), // Remove connection
			u32(nodeCount > 0u), // Change node aggregation
			u32(nodeCount > 0u), // Change node activation
			u32(connCount > 0u), // Change connection from
			u32(connCount > 0u), // Change connection to
			u32(connCount > 0u)  // Change connection weight
		);

		var cumulative = 0.0;
		for (var i = 0; i < 10; i++) {
			if (conditions[i] != 0u) {
				cumulative += probabilities[i];
			}
		}

		let thresholds = array<f32, 9>();
		var sum = 0.0;
		for (var i = 0; i < 9; i++) {
			if (conditions[i] != 0u) {
				let p = probabilities[i] / cumulative;
				sum += p;
				thresholds[i] = sum;
			} else {
				thresholds[i] = 0.0;
			}
		}
		
		// Add node (only if void genes available)
		if (mutationType < thresholds[0]) {
			let voidIdx = findVoidGene(&genome);
			let nodeIndex = nodeCount + INNATE_NODES;
			genome[voidIdx * 4u + 0u] = 1.0; // node gene type
			genome[voidIdx * 4u + 1u] = f32(nodeIndex);
			genome[voidIdx * 4u + 2u] = f32(rng_u32_range(&rng, AGGREGATION_COUNT));
			genome[voidIdx * 4u + 3u] = f32(rng_u32_range(&rng, ACTIVATION_COUNT));
		}
		
		// Remove node (only if nodes exist)
		else if (mutationType < thresholds[1]) {
			let nodeIdx = findNthGene(&genome, 1u, rng_u32_range(&rng, nodeCount));
			// Convert to void gene
			genome[nodeIdx * 4u + 0u] = 0.0;
			genome[nodeIdx * 4u + 1u] = 0.0;
			genome[nodeIdx * 4u + 2u] = 0.0;
			genome[nodeIdx * 4u + 3u] = 0.0;
		}
		
		// Add connection (only if void genes available)
		else if (mutationType < thresholds[2]) {
			let voidIdx = findVoidGene(&genome);
			// Random from: input (0-5) or custom node (9+)
			let fromRand = rng_u32_range(&rng, 6u + nodeCount);
			let fromNode = select(fromRand + 3u, fromRand, fromRand < 6u); // skip outputs 6,7,8
			// Random to: output (6-8) or custom node (9+)
			let toRand = rng_u32_range(&rng, 3u + nodeCount);
			let toNode = toRand + 6u;
			
			genome[voidIdx * 4u + 0u] = 2.0; // connection gene type
			genome[voidIdx * 4u + 1u] = f32(fromNode);
			genome[voidIdx * 4u + 2u] = f32(toNode);
			genome[voidIdx * 4u + 3u] = f32(rng_u32_range(&rng, 256u));
		}
		
		// Remove connection (only if connections exist)
		else if (mutationType < thresholds[3]) {
			let connIdx = findNthGene(&genome, 2u, rng_u32_range(&rng, connCount));
			// Convert to void gene
			genome[connIdx * 4u + 0u] = 0.0;
			genome[connIdx * 4u + 1u] = 0.0;
			genome[connIdx * 4u + 2u] = 0.0;
			genome[connIdx * 4u + 3u] = 0.0;
		}
		
		// Change node aggregation (only if nodes exist)
		else if (mutationType < thresholds[4]) {
			let nodeIdx = findNthGene(&genome, 1u, rng_u32_range(&rng, nodeCount));
			genome[nodeIdx * 4u + 2u] = f32(rng_u32_range(&rng, AGGREGATION_COUNT));
		}
		
		// Change node activation (only if nodes exist)
		else if (mutationType < thresholds[5]) {
			let nodeIdx = findNthGene(&genome, 1u, rng_u32_range(&rng, nodeCount));
			genome[nodeIdx * 4u + 3u] = f32(rng_u32_range(&rng, ACTIVATION_COUNT));
		}
		
		// Change connection from (only if connections exist)
		else if (mutationType < thresholds[6]) {
			let connIdx = findNthGene(&genome, 2u, rng_u32_range(&rng, connCount));
			let fromRand = rng_u32_range(&rng, 6u + nodeCount);
			let fromNode = select(fromRand + 3u, fromRand, fromRand < 6u);
			genome[connIdx * 4u + 1u] = f32(fromNode);
		}
		
		// Change connection to (only if connections exist)
		else if (mutationType < thresholds[7]) {
			let connIdx = findNthGene(&genome, 2u, rng_u32_range(&rng, connCount));
			let toRand = rng_u32_range(&rng, 3u + nodeCount);
			let toNode = toRand + 6u;
			genome[connIdx * 4u + 2u] = f32(toNode);
		}
	
		// Change connection weight (only if connections exist)
		else if (mutationType < thresholds[8]) {
			let connIdx = findNthGene(&genome, 2u, rng_u32_range(&rng, connCount));
			genome[connIdx * 4u + 3u] = f32(rng_u32_range(&rng, 256u));
		}
	}
	
	// Write genome to offspring (either elite unchanged or mutated)
	for (var i = 0u; i < 120u; i++) {
		offspring[offspringOffset + i] = genome[i];
	}
}
