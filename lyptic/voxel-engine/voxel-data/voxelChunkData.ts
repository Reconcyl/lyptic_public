import {vec3} from "gl-matrix";
import {CHUNK_BLOCK_COUNT, encodeChunkPos, FaceDefinition, FaceKey} from "./faces";
import {signedModulo} from "../utils/scalar";

export interface IVoxelChunkDataWrapper<TChunkWrapper extends IVoxelChunkDataWrapper<TChunkWrapper, TVoxel>, TVoxel> {
    voxel_chunk_data: VoxelChunkData<TChunkWrapper, TVoxel>;
}

/**
 * @desc Stores voxel data for a single chunk of size CHUNK_BLOCK_COUNT x CHUNK_BLOCK_COUNT x CHUNK_BLOCK_COUNT.
 * Voxel data can be anything. Provides ability to procure voxel pointers for voxels inside this chunk for reading data about
 * that voxel and its neighbors.
 */
export class VoxelChunkData<TChunkWrapper extends IVoxelChunkDataWrapper<TChunkWrapper, TVoxel>, TVoxel> {
    /**
     * @desc Stores all voxels in the chunk. Uses encoded chunk positions.
     */
    public readonly voxels = new Map<number, TVoxel>();
    /**
     * @desc A map of neighboring chunks for use in ChunkVoxelPointers.
     */
    public readonly neighbors = new Map<FaceKey, TChunkWrapper>();

    constructor(public readonly wrapper: TChunkWrapper, public readonly ref_chunk_pos: vec3) {}

    /**
     * @desc Constructs a new voxel pointer for a voxel in this chunk.
     * @param rel_pos: Position of voxel in chunk relative space ie vec3<[0, chunk_size), [0, chunk_size), [0, chunk_size)>.
     * NOTE: Using a rel_pos outside outside of this chunk will result in undefined behavior.
     */
    getVoxelPointer(rel_pos: vec3): VoxelChunkPointer<TChunkWrapper, TVoxel> {
        return new VoxelChunkPointer<TChunkWrapper, TVoxel>(this.wrapper, rel_pos, encodeChunkPos(rel_pos));
    }

    getChunkRootPosWs(write_to = vec3.create()): vec3 {
        return vec3.scale(write_to, this.ref_chunk_pos, CHUNK_BLOCK_COUNT);
    }

    chunkRelativePosToWs(relative_pos: vec3, write_to = vec3.create()) {
        this.getChunkRootPosWs(write_to);
        return vec3.add(write_to, write_to, relative_pos);
    }

    getNeighborChunkPos(face: FaceDefinition, write_to = vec3.create()): vec3 {
        return vec3.add(write_to, this.ref_chunk_pos, face.vec_relative);
    }
}

/**
 * @desc Points towards a voxel in a chunk. All actions performed by this vector only happen on the voxel data object and
 * nothing else gets updated automatically.
 */
export class VoxelChunkPointer<TChunkWrapper extends IVoxelChunkDataWrapper<TChunkWrapper, TVoxel>, TVoxel> {
    /**
     * @desc Creates a new voxel chunk pointer.
     * NOTE: It is recommended to use VoxelChunkData.getVoxelPointer() instead as for most external purposes, this is all need.
     * @param chunk_wrapped: The wrapped chunk that this pointer is pointing at.
     * @param ref_pos: The position of the voxel in chunk relative space.
     * This position is never modified by this utility however you must ensure that if the position object gets
     * modified externally, the encoded_position must also change.
     * @param encoded_pos: The position of the voxel in chunk relative space. Must update
     */
    constructor(public readonly chunk_wrapped: TChunkWrapper, public ref_pos: vec3, public encoded_pos: number) {
        this.encoded_pos = encodeChunkPos(ref_pos);
    }

    /**
     * @desc Returns the neighboring voxel on a specified face. Will return a new pointer unless the voxel is in a neighboring
     * chunk which doesn't exist. This voxel may or may not exist in the chunk data.
     * @param face: The neighboring face you wish to query.
     */
    getNeighbor(face: FaceDefinition): VoxelChunkPointer<TChunkWrapper, TVoxel> | null {
        const new_pos = vec3.create();
        vec3.add(new_pos, this.ref_pos, face.vec_relative);
        const face_axis_value = new_pos[face.axis.vec_axis];
        if (face_axis_value < 0 || face_axis_value >= CHUNK_BLOCK_COUNT) {  // No longer in the chunk bounds.
            const new_chunk = this.chunk_wrapped.voxel_chunk_data.neighbors.get(face.towards_key);
            if (new_chunk == null) return null;
            new_pos[face.axis.vec_axis] = signedModulo(face_axis_value, CHUNK_BLOCK_COUNT);
            return new VoxelChunkPointer<TChunkWrapper, TVoxel>(new_chunk, new_pos, encodeChunkPos(new_pos));
        } else {
            return new VoxelChunkPointer<TChunkWrapper, TVoxel>(this.chunk_wrapped, new_pos, this.encoded_pos + face.encoded_relative);
        }
    }

    /**
     * @desc Sets value for voxel currently pointed at, "creating" the voxel if it does not already exist.
     * @param data: The data of user-defined type.
     */
    setData(data: TVoxel) {
        this.chunk_wrapped.voxel_chunk_data.voxels.set(this.encoded_pos, data);
    }

    /**
     * @desc Returns the data for the voxel being pointed at or "undefined" if the voxel doesn't exist.
     */
    getData() {
        return this.chunk_wrapped.voxel_chunk_data.voxels.get(this.encoded_pos);
    }

    /**
     * @desc Checks if the chunk has the voxel being pointed at.
     */
    hasVoxel() {
        return this.chunk_wrapped.voxel_chunk_data.voxels.has(this.encoded_pos);
    }

    /**
     * @desc Removes the voxel being pointed at from the chunk.
     * Fails silently if the voxel doesn't exist.
     */
    removeVoxel() {
        this.chunk_wrapped.voxel_chunk_data.voxels.delete(this.encoded_pos);
    }

    /**
     * @desc Replaces the position vector with a new position vector and properly re-encodes the position.
     * @param ref_pos: Position of target voxel in chunk relative space.
     * NOTE: Moving to positions outside of the current chunk is undefined behavior.
     * NOTE: Same rules as ref_pos in constructor apply here as well!
     */
    moveTo(ref_pos: vec3) {
        this.encoded_pos = encodeChunkPos(ref_pos);
        this.ref_pos = ref_pos;
    }

    /**
     * @desc Gets the position of the voxel in world space.
     */
    getPosWs(): vec3 {
        return this.chunk_wrapped.voxel_chunk_data.chunkRelativePosToWs(this.ref_pos);
    }

    /**
     * @desc Clones the pointer.
     */
    clone() {
        return new VoxelChunkPointer(this.chunk_wrapped, vec3.clone(this.ref_pos), this.encoded_pos);
    }

    /**
     * @desc Checks whether or not two pointers point to the same voxel
     */
    equals(other: VoxelChunkPointer<TChunkWrapper, TVoxel> | null): boolean {
        if (other == null) return false;
        return this.encoded_pos == other.encoded_pos  // Check position
            && this.chunk_wrapped.voxel_chunk_data == other.chunk_wrapped.voxel_chunk_data;  // Check chunk (and world)
    }
}