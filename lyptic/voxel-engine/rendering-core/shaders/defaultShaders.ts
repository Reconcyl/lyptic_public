import {GlCtx} from "../../utils/typeSafety/aliases";
import {OptionalReasoned} from "../../utils/typeSafety/optionals";
import {GlShaderUtils} from "../../utils/loading/shaderLoading";
import VOXEL_VERTEX_SOURCE from "./voxel.vert";
import VOXEL_FRAG_SOURCE from "./voxel.frag";
import MESH_VERTEX_SOURCE from "./simple_mesh.vert";
import MESH_FRAG_SOURCE from "./simple_mesh.frag";

function makeShaderLoader<TWrapped>(sources: { VERTEX: string, FRAGMENT: string}, wrapper: (gl: GlCtx, program: WebGLProgram) => TWrapped) {
    return {
        /**
         * @desc The sources for the default voxel rendering shaders
         */
        source: sources,

        /**
         * @desc Wraps an already loaded shader program in a VoxelRenderingShader data structure for use by default voxel
         * rendering logic. Finds locations of all attributes and uniforms assuming the types and names of the defaults
         * don't change.
         * @param gl: The WebGL context
         * @param program: The program to be wrapped. Must have attribute and uniform names comply with those of the default
         * shader. Fails silently otherwise.
         */
        wrapLoadedProgram: wrapper,

        /**
         * @desc Loads the default shaders from VOXEL_RENDERING_SHADER.source and wraps it.
         * @param gl: The WebGl context
         * @returns An optional with either the wrapped program or a failure state.
         */
        loadDefaultShader(gl: GlCtx): OptionalReasoned<TWrapped> {
            const {VERTEX, FRAGMENT} = this.source;
            const program_optional = GlShaderUtils.loadProgram(gl, VERTEX, FRAGMENT);
            if (!OptionalReasoned.isPresent(program_optional.raw)) return program_optional as any;
            return OptionalReasoned.success(this.wrapLoadedProgram(gl, program_optional.raw.obj));
        }
    }
}

export type VoxelRenderingShaderInfo = {
    program: WebGLProgram,
    uniform_chunk_pos: WebGLUniformLocation,
    uniform_projection_mat: WebGLUniformLocation,
    uniform_view_mat: WebGLUniformLocation,
    uniform_textures_sampler: WebGLUniformLocation,
    uniform_textures_count: WebGLUniformLocation,
    attrib_vertex_data: number
};

export const CoreVoxelShaderLoader = makeShaderLoader<VoxelRenderingShaderInfo>({
    VERTEX: VOXEL_VERTEX_SOURCE,
    FRAGMENT: VOXEL_FRAG_SOURCE
}, (gl, program) => {
    return {
        program,
        uniform_view_mat: gl.getUniformLocation(program, "view")!,
        uniform_projection_mat: gl.getUniformLocation(program, "projection")!,
        uniform_chunk_pos: gl.getUniformLocation(program, "chunk_pos")!,
        uniform_textures_sampler: gl.getUniformLocation(program, "texture_sampler")!,
        uniform_textures_count: gl.getUniformLocation(program, "tex_frame_counts")!,
        attrib_vertex_data: gl.getAttribLocation(program, "vertex_data")
    }
});

export type SimpleMeshRenderingShaderInfo = {
    program: WebGLProgram,
    attrib_uv: number,
    attrib_pos: number,
    uniform_projection_mat: WebGLUniformLocation,
    uniform_view_mat: WebGLUniformLocation,
    uniform_sampler: WebGLUniformLocation,

};

export const CoreEntityShaderLoader = makeShaderLoader<SimpleMeshRenderingShaderInfo>({
    VERTEX: MESH_VERTEX_SOURCE,
    FRAGMENT: MESH_FRAG_SOURCE
}, (gl, program) => {
    return {
        program,
        attrib_uv: gl.getAttribLocation(program, "uv")!,
        attrib_pos: gl.getAttribLocation(program, "pos")!,
        uniform_projection_mat: gl.getUniformLocation(program, "projection")!,
        uniform_view_mat: gl.getUniformLocation(program, "view")!,
        uniform_sampler: gl.getUniformLocation(program, "texture_sampler")!
    }
});