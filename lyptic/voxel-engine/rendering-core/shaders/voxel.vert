precision mediump float;

// Configuration constants
const float POS_ENCODING_CHUNK_DIM = 17.0;  // The chunk size is always 1 more than the amount of blocks in the chunk.
const float VOXEL_WORLD_SIZE = 1.0;

// Uniforms
uniform vec3 chunk_pos;
uniform mat4 projection;
uniform mat4 view;

uniform vec2 tex_frame_counts;

// Vertex attributes
attribute vec2 vertex_data;  // (pos_idx, material: 8<texture_id> 6<light> 1<uv x> 1<uv y>)
#define pos_idx vertex_data.x
#define mat_data vertex_data.y

// Varyings
varying float light;
varying vec2 uv;
varying float distance;

void main() {
    // Voxel world position resolver
    float vy_unwrapped = floor(pos_idx / POS_ENCODING_CHUNK_DIM);
    vec3 world_pos = VOXEL_WORLD_SIZE * (
        chunk_pos * (POS_ENCODING_CHUNK_DIM - 1.0) +
        vec3(
            mod(pos_idx, POS_ENCODING_CHUNK_DIM),
            mod(vy_unwrapped, POS_ENCODING_CHUNK_DIM),
            floor(vy_unwrapped / POS_ENCODING_CHUNK_DIM)));

    // Texture processing
    float texture_idx = floor(mat_data / 256.0);  // 8<texture_id>
    float second_part = mod(mat_data, 256.0);  // 6<light> 2<uv>
    light = floor(second_part / 4.0);
    float uv_encoded = mod(second_part, 4.0);

    vec2 global_uv = vec2(
        mod(texture_idx, tex_frame_counts.x),
        floor(texture_idx / tex_frame_counts.x)
    );
    vec2 cell_uv = vec2((mod(uv_encoded, 2.0) == 1.0 ? 1.0 : 0.0), (uv_encoded > 1.0 ? 1.0 : 0.0));
    uv =  (global_uv + cell_uv) / vec2(tex_frame_counts.x, tex_frame_counts.y);  // Convert to absolute texture UV

    // Gl stuff
    vec4 transformed_pos = view * vec4(world_pos, 1.0);
    gl_Position = projection * transformed_pos;
    distance = length(transformed_pos.xyz);
}