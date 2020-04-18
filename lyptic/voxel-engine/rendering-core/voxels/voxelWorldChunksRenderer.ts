import {GlCtx} from "../../utils/typeSafety/aliases";
import {VoxelRenderingShaderInfo} from "../shaders/defaultShaders";
import {IVoxelChunkRendererWrapper} from "./voxelChunkRenderer";
import {FpsCameraController} from "../fpsCameraController";
import {IVoxelChunkDataWrapper} from "../../voxel-data/voxelChunkData";

export class VoxelChunkWorldRendering {
    /**
     * @desc Creates a new chunk world renderer.
     * @param camera: The active camera. The camera's state and which camera is active can be modified however you must
     * update the GPU's shader uniforms when this happens.
     */
    constructor(public camera: FpsCameraController) {}

    /**
     * @desc Renders the chunks provided by the chunk_provider iterator. Employs frustum culling on a chunk by chunk basis
     * based on the cpu mirror of the projection and view states.
     * NOTE: This method modifies the actively bound shader program.
     * NOTE: This method has all the same WebGl register preconditions as VoxelChunkRenderer
     * @param gl: The WebGl context
     * @param program: The shader being used for rendering voxel chunks
     * @param chunk_provider: An iterator providing the chunk wrappers to be renderer.
     */
    render<TChunk extends IVoxelChunkDataWrapper<TChunk, any> & IVoxelChunkRendererWrapper>(gl: GlCtx, program: VoxelRenderingShaderInfo, chunk_provider: IterableIterator<TChunk>) {
        gl.useProgram(program.program);
        for (const chunk of chunk_provider) {  // TODO: Culling
            chunk.voxel_chunk_renderer.render(gl, program, chunk.voxel_chunk_data.ref_chunk_pos);
        }
    }
}