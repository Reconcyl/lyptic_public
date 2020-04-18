import {GlCtx} from "../../utils/typeSafety/aliases";
import {vec2, vec3} from "gl-matrix";
import {SimpleMeshRenderingShaderInfo} from "../shaders/defaultShaders";

export type SimpleMeshTriangleVert = {
    position: vec3
    uv: vec2
};
const BYTES_PER_VERTEX = 5;
export class SimpleMeshRenderer {
    public readonly vertex_count: number;

    /**
     * @desc Constructs a new mesh renderer. Uploads the vertex data to the buffer.
     * @param gl: The GlCtx.
     * @param buffer: A buffer that can be used for rendering the mesh.
     * @param vertices: The vertex data of the mesh.
     */
    constructor(gl: GlCtx, private readonly buffer: WebGLBuffer, vertices: SimpleMeshTriangleVert[]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        this.vertex_count = vertices.length;
        const mesh_buffer = new Float32Array(vertices.length * BYTES_PER_VERTEX);
        {
            let buffer_idx = 0;
            for (const vertex of vertices) {
                mesh_buffer[buffer_idx] = vertex.position[0];
                mesh_buffer[buffer_idx + 1] = vertex.position[1];
                mesh_buffer[buffer_idx + 2] = vertex.position[2];
                mesh_buffer[buffer_idx + 3] = vertex.uv[0];
                mesh_buffer[buffer_idx + 4] = vertex.uv[1];
                buffer_idx += BYTES_PER_VERTEX;
            }
        }
        gl.bufferData(gl.ARRAY_BUFFER, mesh_buffer, gl.STATIC_DRAW);
    }

    /**
     * @desc Sets the following gl registers:
     * - Sets VAP (no enable status)
     * - Binds the buffer
     */
    bindMesh(gl: GlCtx, program: SimpleMeshRenderingShaderInfo) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(program.attrib_pos, 3, gl.FLOAT, false, 4 * BYTES_PER_VERTEX, 0);
        gl.vertexAttribPointer(program.attrib_uv, 2, gl.FLOAT, false, 4 * BYTES_PER_VERTEX, 4 * 3);
    }

    /**
     * @desc Just renders the mesh. That's it. No bindings.
     * That said, the gl registers must be in the following state:
     * - Simple mesh rendering shader must be active
     * - View and projection uniform matrices must be provided
     * - Texture unit must be ready and referenced by the uniform
     * - The attributes attrib_pos and attrib_uv must be enabled and their lookup must be specified
     * - Clipping and depth test should be setup
     * @param gl
     */
    render(gl: GlCtx) {
        gl.drawArrays(gl.TRIANGLES, 0, this.vertex_count);
    }
}