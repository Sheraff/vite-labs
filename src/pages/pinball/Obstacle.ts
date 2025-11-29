export class Bumper {
	render() {
		this.ctx.beginPath()
		this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
		this.ctx.fillStyle = '#ff6b6b'
		this.ctx.fill()
		this.ctx.strokeStyle = '#ff4757'
		this.ctx.lineWidth = 2
		this.ctx.stroke()
	}
}