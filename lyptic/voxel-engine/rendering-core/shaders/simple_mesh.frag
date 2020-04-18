precision mediump float;

// Uniforms
uniform sampler2D texture_sampler;

// Varyings
varying vec2 out_uv;
varying float distance;

const float max_dist = 50.0;

void main() {
    vec4 frag = texture2D(texture_sampler, out_uv);
    if (frag.a < 0.5) {
        discard;
    } else {
        gl_FragColor = mix(  // TODO: Make less hacky fog
            frag,
            vec4(30.0 / 255.0, 30.0 / 255.0, 50.0 / 255.0, 1.0),
            clamp(distance / max_dist, 0.0, 1.0)
        );
    }
}