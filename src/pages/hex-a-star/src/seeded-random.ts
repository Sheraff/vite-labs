/*
Copyright 2019 David Bau.
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const pool: number[] = []
//
// The following constants are related to IEEE 754 limits.
//

const width = 256,        // each RC4 output is 0 <= x < 256
	chunks = 6,         // at least six RC4 outputs for each double
	digits = 52,        // there are 52 significant digits in a double
	startdenom = Math.pow(width, chunks),
	significance = Math.pow(2, digits),
	overflow = significance * 2,
	mask = width - 1

export interface PRNG {
	(): number
	int32(): number
	quick(): number
	double(): number
	state?: () => State
}

type State = {
	i: number
	j: number
	S: number[]
}

type Options = {
	entropy?: boolean
	global?: boolean
	state?: State
}

//
// seedrandom()
// This is the seedrandom function described above.
//
export default function seedrandom(seed: string = autoseed(), options: Options = { entropy: true }) {
	const key: number[] = []

	// Flatten the seed string or build one from local entropy if needed.
	mixkey(options.entropy ? [seed, tostring(pool)] : seed, key)

	// Use the seed to initialize an ARC4 generator.
	const arc4 = new ARC4(key) as Arc4

	// This function returns a random double in [0, 1) that contains
	// randomness in every bit of the mantissa of the IEEE 754 value.
	const prng: PRNG = function () {
		let n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
			d = startdenom,                  //   and denominator d = 2 ^ 48.
			x = 0                            //   and no 'extra last byte'.
		while (n < significance) {          // Fill up all significant digits by
			n = (n + x) * width              //   shifting numerator and
			d *= width                       //   denominator and generating a
			x = arc4.g(1)                    //   new least-significant-byte.
		}
		while (n >= overflow) {             // To avoid rounding up, before adding
			n /= 2                           //   last byte, shift everything
			d /= 2                           //   right using integer math until
			x >>>= 1                         //   we have exactly the desired bits.
		}
		return (n + x) / d                 // Form the number within [0, 1).
	}
	prng.int32 = function () { return arc4.g(4) | 0 }
	prng.quick = function () { return arc4.g(4) / 0x100000000 }
	prng.double = prng

	// Mix the randomness into accumulated entropy.
	mixkey(tostring(arc4.S), pool)

	// Calling convention: what to return as a function of prng, seed, is_math.
	return prng
}

type Arc4 = {
	i: number
	j: number
	S: number[]
	g(count: number): number
}

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
function ARC4(this: Arc4, key: number[]) {
	var t
	let keylen = key.length
	const me = this
	let i = 0
	let j = me.i = me.j = 0
	const s = me.S = [] as number[]

	// The empty key [] is treated as [0].
	if (!keylen) { key = [keylen++] }

	// Set up S using the standard key scheduling algorithm.
	while (i < width) {
		s[i] = i++
	}
	for (i = 0; i < width; i++) {
		s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))]
		s[j] = t
	}

	// The "g" method returns the next (count) outputs as one number.
	(me.g = function (count: number) {
		// Using instance members instead of closure state nearly doubles speed.
		var t, r = 0,
			i = me.i, j = me.j, s = me.S
		while (count--) {
			t = s[i = mask & (i + 1)]
			r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))]
		}
		me.i = i; me.j = j
		return r
		// For robust unpredictability, the function call below automatically
		// discards an initial batch of values.  This is called RC4-drop[256].
		// See http://google.com/search?q=rsa+fluhrer+response&btnI
	})(width)
}

type Seed = number | string | Array<Seed>

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
function mixkey(seed: Seed, key: number[]) {
	var stringseed = seed + '', smear = 0, j = 0
	while (j < stringseed.length) {
		key[mask & j] =
			mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++))
	}
	return tostring(key)
}

//
// autoseed()
// Returns an object for autoseeding, using window.crypto
//
function autoseed() {
	const out = new Uint8Array(width)
	globalThis.crypto.getRandomValues(out)
	return tostring(out)
}

//
// tostring()
// Converts an array of charcodes to a string
//
function tostring(a: number[] | Uint8Array) {
	return String.fromCharCode.apply(0, a as number[])
}

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to interfere with deterministic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(Math.random(), pool)
