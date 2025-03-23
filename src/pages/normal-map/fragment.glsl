precision mediump float;

uniform vec2 resolution;

uniform vec2 u_texture_size;
uniform sampler2D u_texture;
uniform sampler2D u_normal_map;

uniform vec3 u_light_position;

uniform float max_distance;
uniform float color_flag;
uniform float ambient;
uniform float easing;


void ease(in float easing, inout float value) {
	if (easing == 0.0) { // linear
		return;
	} else if (easing == 1.0) { // ease-in
		value = pow(value, 2.0);
	} else if (easing == 2.0) { // ease-out
		value = 1.0 - pow(1.0 - value, 2.0);
	} else if (easing == 3.0) { // ease-in-out
		value = value < 0.5 ? 
			pow(value, 2.0) * 2.0 : 
			1.0 - pow(2.0 - value * 2.0, 2.0) / 2.0;
	} else if (easing == 4.0) { // ease-in-sine
		value = 1.0 - cos(value * 3.14159265 / 2.0);
	} else if (easing == 5.0) { // ease-out-sine
		value = sin(value * 3.14159265 / 2.0);
	} else if (easing == 6.0) { // ease-in-out-sine
		value = (1.0 - cos(value * 3.14159265)) / 2.0;
	} else if (easing == 7.0) { // ease-in-cubic
		value = pow(value, 3.0);
	} else if (easing == 8.0) { // ease-out-cubic
		value = 1.0 - pow(1.0 - value, 3.0);
	} else if (easing == 9.0) { // ease-in-out-cubic
		value = value < 0.5 ? 
			pow(value, 3.0) * 4.0 : 
			1.0 - pow(2.0 - value * 2.0, 3.0) / 2.0;
	} else if (easing == 10.0) { // ease-in-quart
		value = pow(value, 4.0);
	} else if (easing == 11.0) { // ease-out-quart
		value = 1.0 - pow(1.0 - value, 4.0);
	} else if (easing == 12.0) { // ease-in-out-quart
		value = value < 0.5 ? 
			pow(value, 4.0) * 8.0 : 
			1.0 - pow(2.0 - value * 2.0, 4.0) / 2.0;
	}
}

void main() {
	// flip y axis, normalize to [0, 1]
	vec2 uv = gl_FragCoord.xy / resolution.xy * vec2(1.0, -1.0);

	float texture_aspect = u_texture_size.x / u_texture_size.y;
	float screen_aspect = resolution.x / resolution.y;

	vec2 texture_pos;
	if (screen_aspect > texture_aspect) {
		// Screen is wider than texture
		texture_pos.x = uv.x;
		texture_pos.y = (uv.y + 0.5) * texture_aspect / screen_aspect - 0.5;
	} else {
		// Screen is taller than texture
		texture_pos.x = (uv.x - 0.5) * screen_aspect / texture_aspect + 0.5;
		texture_pos.y = uv.y;
	}
	
	vec3 rgb = texture2D(u_normal_map, texture_pos).xyz;
	vec3 normal = rgb * vec3(2.0, 2.0, 1.0) - vec3(1.0, 1.0, 0.0);

	vec2 corrected = vec2(u_light_position.x, resolution.y - u_light_position.y);
	vec3 light = vec3(gl_FragCoord.xy - corrected.xy, u_light_position.z);
	vec3 normalized_light = normalize(light);

	float distance_to_light = 1.0 - distance(gl_FragCoord.xy, corrected.xy) / max_distance;
	float distance_clamped = clamp(distance_to_light, 0.0, 1.0);
	ease(easing, distance_clamped);

	float dot_product = min(max(dot(normal, normalized_light), 0.0), 1.0);
	vec3 color = color_flag * texture2D(u_texture, texture_pos).xyz + 
		(1.0 - color_flag) * vec3(1.0, 1.0, 1.0);

	float mul = (1.0 - ambient) * dot_product * distance_clamped + ambient;

	gl_FragColor = vec4(
		color * mul,
		1.0
	);
}
