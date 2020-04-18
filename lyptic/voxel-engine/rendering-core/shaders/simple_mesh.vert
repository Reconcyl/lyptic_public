precision mediump float;

// Vertex attributes
attribute vec2 uv;
attribute vec4 pos;

// Uniforms
uniform mat4 projection;
uniform mat4 view;

// Varyings
varying vec2 out_uv;
varying float distance;

void main() {
    out_uv = uv;
    vec4 transformed_pos = view * pos;
    distance = length(transformed_pos);
    gl_Position = projection * transformed_pos;
}