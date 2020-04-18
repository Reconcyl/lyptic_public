precision mediump float;
varying vec2 uv;
varying float light;
varying float distance;
uniform sampler2D texture_sampler;

const float max_dist = 50.0;

void main() {
    gl_FragColor = mix(  // TODO: Make less hacky fog
        texture2D(texture_sampler, uv) * vec4(vec3(light / 32.0), 1.0),
        vec4(30.0 / 255.0, 30.0 / 255.0, 50.0 / 255.0, 1.0),
        clamp(distance / max_dist, 0.0, 1.0)
    );
}