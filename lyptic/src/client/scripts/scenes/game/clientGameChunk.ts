import {
    IVoxelChunkDataWrapper,
    VoxelChunkData,
    VoxelChunkPointer
} from "../../../../../voxel-engine/voxel-data/voxelChunkData";
import {
    IVoxelChunkRendererWrapper,
    IVoxelMaterialProvider,
    VoxelChunkRenderer
} from "../../../../../voxel-engine/rendering-core/voxels/voxelChunkRenderer";
import {GlCtx} from "../../../../../voxel-engine/utils/typeSafety/aliases";
import {vec3} from "gl-matrix";
import {range} from "../../../../shared/world_generation/utils";
import {BlockType} from "../../../../shared/gameplay/data/blockIds";

const material_provider: IVoxelMaterialProvider<ClientGameChunk, BlockType> = {
    parseMaterialOfVoxel(pointer, face) {
        return {
            light: [20, 10, 16, 16, 32, 20][face.index],
            texture: pointer.getData()!
        }
    },
    isVoxelSolid(pointer: VoxelChunkPointer<ClientGameChunk, BlockType> | null): boolean {
        return pointer != null && pointer.hasVoxel();
    }
}

export class ClientGameChunk implements IVoxelChunkDataWrapper<ClientGameChunk, BlockType>, IVoxelChunkRendererWrapper {
    public readonly voxel_chunk_data: VoxelChunkData<ClientGameChunk, BlockType>;
    public readonly voxel_chunk_renderer: VoxelChunkRenderer;

    private readonly write_pointer: VoxelChunkPointer<ClientGameChunk, BlockType>;
    private readonly modified_voxels: vec3[];

    constructor(gl: GlCtx, chunk_pos: vec3) {
        this.voxel_chunk_data = new VoxelChunkData<ClientGameChunk, BlockType>(this, chunk_pos);
        this.voxel_chunk_renderer = new VoxelChunkRenderer(gl, gl.createBuffer()!);
        this.write_pointer = this.voxel_chunk_data.getVoxelPointer([0, 0, 0]);
        this.modified_voxels = [];
    }

    setDataAt(pos: vec3, data: BlockType) {
        pos = vec3.clone(pos);
        this.write_pointer.moveTo(pos);
        if (this.write_pointer.getData() == undefined) {
            this.write_pointer.setData(data);
            this.modified_voxels.push(pos);
        }
    }

    fillRect(p1: vec3, p2: vec3, data: BlockType) {
        for (let x of range(p1[0], p2[0])) {
            for (let y of range(p1[1], p2[1])) {
                for (let z of range(p1[2], p2[2])) {
                    this.setDataAt([x, y, z], data);
                }
            }
        }
    }

    registerGeneration(gl: GlCtx) {
        this.voxel_chunk_renderer.handleVoxelModifications(gl, this, this.modified_voxels, material_provider);
        this.modified_voxels.length = 0;
    }

    updateVoxel(gl: GlCtx, pos: vec3) {
        this.voxel_chunk_renderer.handleVoxelModifications(gl, this, [pos], material_provider);
    }
}