export function webGLSetup(gl: WebGLRenderingContext, side: number, COUNT: number) {
	// Vertex shader
	const vertSrc = `
		attribute vec2 a_position;
		attribute vec2 a_boid_pos;
		attribute float a_boid_angle;
		void main() {
			float c = cos(a_boid_angle);
			float s = sin(a_boid_angle);
			// Rotate
			vec2 rotated = vec2(
				a_position.x * c - a_position.y * s,
				a_position.x * s + a_position.y * c
			);
			// Translate to boid position (convert to clip space)
			float tx = (a_boid_pos.x / float(${side})) * 2.0 - 1.0;
			float ty = (a_boid_pos.y / float(${side})) * 2.0 - 1.0;
			// Scale triangle to clip space
			vec2 pos = rotated / float(${side}) * 2.0 + vec2(tx, ty);
			gl_Position = vec4(pos, 0, 1);
		}
	`
	// Fragment shader
	const fragSrc = `
		precision mediump float;
		void main() {
			gl_FragColor = vec4(1, 1, 1, 1);
		}
	`

	const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc)
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc)
	const program = createProgram(gl, vs, fs)
	const a_position = gl.getAttribLocation(program, 'a_position')
	const a_boid_pos = gl.getAttribLocation(program, 'a_boid_pos')
	const a_boid_angle = gl.getAttribLocation(program, 'a_boid_angle')

	// Triangle for boid (pointing right, centered at origin)
	const size = 3 * window.devicePixelRatio
	const baseTriangle = new Float32Array([
		size, 0,
		-size, size / 2,
		-size, -size / 2,
	])
	const triangleBuffer = gl.createBuffer()!
	gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer)
	gl.bufferData(gl.ARRAY_BUFFER, baseTriangle, gl.STATIC_DRAW)

	// Per-boid data: position (x, y) and angle
	const boidData = new Float32Array(COUNT * 3) // [x, y, angle] per boid
	const boidBuffer = gl.createBuffer()!

	// Instancing extension
	const ext = gl.getExtension('ANGLE_instanced_arrays')!

	gl.useProgram(program)
	// Set up static base triangle attribute
	// a_position
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuffer)
		gl.enableVertexAttribArray(a_position)
		gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0)
		ext.vertexAttribDivisorANGLE(a_position, 0)
	}
	// Set up per-boid attributes (divisor=1)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, boidBuffer)
		// a_boid_pos
		gl.enableVertexAttribArray(a_boid_pos)
		gl.vertexAttribPointer(a_boid_pos, 2, gl.FLOAT, false, 12, 0)
		ext.vertexAttribDivisorANGLE(a_boid_pos, 1)
		// a_boid_angle
		gl.enableVertexAttribArray(a_boid_angle)
		gl.vertexAttribPointer(a_boid_angle, 1, gl.FLOAT, false, 12, 8)
		ext.vertexAttribDivisorANGLE(a_boid_angle, 1)
	}
	// Set viewport and clear color once

	gl.viewport(0, 0, side, side)
	gl.clearColor(0, 0, 0, 0)

	return {
		draw: () => {
			gl.clear(gl.COLOR_BUFFER_BIT)
			// Only update per-boid buffer and draw
			gl.bindBuffer(gl.ARRAY_BUFFER, boidBuffer)
			gl.bufferData(gl.ARRAY_BUFFER, boidData, gl.DYNAMIC_DRAW)
			ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 3, COUNT)
		},
		update: (i: number, boid: { x: number; y: number; radians: number }) => {
			boidData[i * 3 + 0] = boid.x
			boidData[i * 3 + 1] = boid.y
			boidData[i * 3 + 2] = boid.radians
		},
		destroy: () => {
			gl.deleteBuffer(triangleBuffer)
			gl.deleteBuffer(boidBuffer)
			gl.useProgram(null)
			// Optionally disable attributes
			gl.disableVertexAttribArray(a_position)
			gl.disableVertexAttribArray(a_boid_pos)
			gl.disableVertexAttribArray(a_boid_angle)
		}
	}
}

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
	const shader = gl.createShader(type)!
	gl.shaderSource(shader, src)
	gl.compileShader(shader)
	return shader
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
	const program = gl.createProgram()!
	gl.attachShader(program, vs)
	gl.attachShader(program, fs)
	gl.linkProgram(program)
	return program
}