import {
    SimpleMeshRenderingShaderInfo,
    VoxelRenderingShaderInfo
} from "../../../../../voxel-engine/rendering-core/shaders/defaultShaders";
import {SimpleMeshRenderer} from "../../../../../voxel-engine/rendering-core/entities/simpleMeshRenderer";

export type ClientGameResources = {
    // Shaders
    shader_voxel: VoxelRenderingShaderInfo,
    shader_simple_mesh: SimpleMeshRenderingShaderInfo,

    // Meshes
    mesh_base: SimpleMeshRenderer,
    mesh_break_indicator: SimpleMeshRenderer
};
export enum ClientGameTextureUnits {
    voxel_textures,
    sad_dude,
    voxel_break_indicator
}
