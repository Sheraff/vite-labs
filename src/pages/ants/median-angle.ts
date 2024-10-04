/**
 * 
 * Implementation of median angle function
 * A More Efficient Way Of Obtaining A Unique Median Estimate For Circular Data
 * 2003 / B. Sango Otieno & Christine M. Anderson-Cook
 * from the annexes in https://digitalcommons.wayne.edu/cgi/viewcontent.cgi?referer=&httpsredir=1&article=1738&context=jmasm
 * 
 */

/**
 * Median Estimate For Circular Data
 * @param array - array of radians (angles or other circular data modulo 2𝜋)
 */
export default function circularMedian(array: number[]) {
	const sx = array.sort()
	const difsin: number[] = []
	const numties: number[] = []

	// Checks if sample size is odd or even
	const posmed = array.length % 2 === 0
		? checkeven(array)
		: checkodd(array)

	for (let i = 0; i < posmed.length; i++) {
		let positive = 0
		let negative = 0
		let ties = 0
		const ref = posmed[i]
		for (let j = 0; j < sx.length; j++) {
			const value = sx[j] - ref
			const sin = Math.sin(value)
			if (sin > 0) positive++
			else if (sin < 0) negative++
			else ties++
		}
		difsin[i] = positive - negative
		numties[i] = ties
	}

	// Checks for ties
	const cm = posmed.filter((x, i) => difsin[i] === 0 || Math.abs(difsin[i]) > numties[i])
	return cm.length
		? averageAngle(cm)
		: Infinity
}

function averageAngle(array: number[]) {
	const y = array.reduce((sum, current) => sum + Math.sin(current))
	const x = array.reduce((sum, current) => sum + Math.cos(current))
	return x === 0 && y === 0
		? Infinity
		: Math.atan2(y, x)
	// If both x and y are zero, then no circular mean exists, so assign it a large number
}

function checkeven(array: number[]) {
	const check = []
	// Computes possible medians
	const posmed = posmedf(array)
	const max = array.length / 2
	for (let i = 0; i < posmed.length; i++) {
		// Takes posmed[i] as the center, i.e. draws diameter at posmed[i] and counts observations on either side of the diameter
		const center = posmed[i]
		let positive = 0
		for (let j = 0; j < array.length; j++) {
			const value = array[j] - center
			const cos = Math.cos(value)
			if (cos > 0) positive++
		}
		check[i] = positive < max
			? Infinity
			: posmed[i]
	}

	return check.filter(x => x !== Infinity)
}

function checkodd(array: number[]) {
	const check = []
	// Each observation is a possible median
	const posmed = array
	const max = (array.length - 1) / 2
	for (let i = 0; i < posmed.length; i++) {
		// Takes posmed[i] as the center, i.e. draws diameter at posmed[i] and counts observations on either side of the diameter
		const center = posmed[i]
		let positive = 0
		for (let j = 0; j < array.length; j++) {
			const value = array[j] - center
			const cos = Math.cos(value)
			if (cos > 0) positive++
		}
		check[i] = positive > max
			? Infinity
			: posmed[i]
	}

	return check.filter(x => x !== Infinity)
}

function posmedf(array: number[]) {
	const sx2 = [...array]
	sx2.push(sx2.shift()!)
	// Determines closest neighbors of a fixed observation
	const posmed = []
	for (let i = 0; i < array.length; i++) {
		posmed[i] = averageAngle([array[i], sx2[i]])
	}
	// Computes circular mean of two adjacent observations
	return posmed.filter(x => x !== Infinity)
}