import {vec3} from "gl-matrix";
import {VoxelWorldData} from "./voxelWorldData";
import {IVoxelChunkDataWrapper, VoxelChunkPointer} from "./voxelChunkData";
import {FACE_AXIS_AND_SIGN_MAP, FaceDefinition, FACES_LIST} from "./faces";

export type VoxelRayCastFaceCollision<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel> = Readonly<{
    /**
     * @desc The voxel which owns the face. This can be null if an occluder determines that there was a collision outside
     * of chunk boundaries.
     */
    collided_voxel: VoxelChunkPointer<TChunk, TVoxel> | null,

    /**
     * @desc The position of the voxel which owns the face in world space. Unlike collided_voxel, this will always be
     * non-null, making it the perfect candidate for fine grained out-of-chunk collisions.
     */
    collided_voxel_pos: vec3,

    /**
     * @desc The voxel face that has been collided with.
     */
    face: FaceDefinition,

    /**
     * @desc The distance between the intersection position and the start of the step.
     * Used mostly internally.
     */
    distance: number,

    /**
     * @desc The position of the intersection between the step segment and the face in world space.
     */
    intersection_pos: vec3
}>;

type RayCasterState<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel> =
    { type: "tracking", pointer: VoxelChunkPointer<TChunk, TVoxel>, position: vec3 } | { type: "floating", position: vec3 };

export class VoxelRayCaster<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel> {
    private state: RayCasterState<TChunk, TVoxel>;

    /**
     * @constructor Constructs a ray that works on a given world and starts at a given position. This class does not
     * perform ray termination automatically as this task is up to the external scope.
     * @param world_data: The world data to be operated on.
     * @param ref_position: The starting position of the ray. THIS VECTOR WILL BE MODIFIED!!!
     */
    constructor(private readonly world_data: VoxelWorldData<TChunk, TVoxel>, ref_position: vec3) {
        this.state = this.get_state_for_pos(ref_position);
    }

    /**
     * @desc Moves the ray caster's "seek" position then figures out which voxel the ray caster is "selecting".
     * This does not take into account face intersections and as such, can phase through diagonals.
     * @param step_delta: The delta of the step.
     * NOTE: Must have a length less 1 as it is imperative that no voxels get skipped.
     */
    stepVoxel(step_delta: vec3): VoxelChunkPointer<TChunk, TVoxel> | null {
        const {state} = this;

        // Update pos. Return early if the new pointer can be found using a "cheap" strategy.
        if (state.type === "tracking") {
            for (let axis = 0; axis < 3; axis++) {
                const old_value = state.position[axis];
                state.position[axis] += step_delta[axis];
                if (Math.floor(old_value) != Math.floor(state.position[axis])) {  // We moved out of the block on this axis.
                    // Try to find the neighboring voxel using the "cheap" strategy.
                    const neighbor_pointer = state.pointer.getNeighbor(
                        FACE_AXIS_AND_SIGN_MAP[axis][step_delta[axis] > 0 ? "positive" : "negative"]);
                    if (neighbor_pointer != null) {
                        state.pointer = neighbor_pointer;
                    } else {
                        this.state = { type: "floating", position: state.position };
                        break;  // Set the state to floating because we moved outside of loaded chunks.
                        // We still need to attempt to re-track a chunk using the long way, which is why we break
                        // instead of returning null.
                    }
                }
            }

            // If we successfully managed to traverse the chunk using the cheap strategy, return the pointer here.
            if (state.type == "tracking") {
                return state.pointer;
            }
        } else {
            const movement = VoxelWorldData.moveByDeltaAndDetectChunkSwitch(state.position, step_delta);
            if (!movement.to_new_chunk) return null;  // We know the pointer is still null because we haven't crossed a chunk boundary and the current chunk is still non-existent.
        }

        // Attempts to re-track a voxel pointer using the "long way" involving map lookups.
        const pointer = this.world_data.getVoxelPointer(state.position);
        if (pointer != null) {
            this.state = { type: "tracking", pointer, position: state.position };
            return pointer;
        } else {
            return null;
        }
    }

    /**
     * @desc Moves the ray caster by the delta, properly taking into account occluding faces. This will not pass through
     * diagonals and will return which side of the voxel it hit.
     * @param step_delta: The delta of the step. Same restrictions as the step_delta in stepVoxel(...)
     * @param is_occluding: A callback to decide whether or not a face is occluding the movement step.
     * @returns A VoxelRayCastFaceCollision object. See its documentation for more info.
     */
    step(step_delta: vec3, is_occluding: (collision: VoxelRayCastFaceCollision<TChunk, TVoxel>) => boolean): VoxelRayCastFaceCollision<TChunk, TVoxel> | null {
        // Determine start and end positions for step
        const start_voxel = this.state.type == "tracking" ?
            this.state.pointer :  // Started inside chunk
            null;  // Started outside chunk
        const segment_start = vec3.clone(this.ref_ray_position);
        const exit_voxel = this.stepVoxel(step_delta);
        const segment_end = this.ref_ray_position;

        if (start_voxel?.equals(exit_voxel))
            return null;  // No new collision has occurred as the segment remained in the same voxel.

        // Find the face intersection nearest to the starting position
        let nearest_collision: VoxelRayCastFaceCollision<TChunk, TVoxel> | null = null;
        function checkVoxelFaceIntersections(voxel: VoxelChunkPointer<TChunk, TVoxel> | null, voxel_pos: vec3) {   // TODO: Optimize faces checked for intersection.
            for (const face of FACES_LIST) {
                // Detect intersection
                const intersection_pos = face.axis.getSegmentIntersection(voxel_pos, face.axis_sign, segment_start, segment_end);
                if (intersection_pos == null) continue;

                // Form collision info
                const distance = vec3.dist(segment_start, intersection_pos);
                const collision: VoxelRayCastFaceCollision<TChunk, TVoxel> = {
                    // Collided voxel data
                    collided_voxel: voxel, collided_voxel_pos: vec3.floor(vec3.create(), voxel_pos), face,

                    // Collision positional data
                    distance, intersection_pos
                };

                // Update nearest collision if applicable
                if ((nearest_collision == null || distance < nearest_collision.distance) && is_occluding(collision)) {
                    nearest_collision = collision;
                }
            }
        }

        checkVoxelFaceIntersections(exit_voxel, segment_end);
        const neighbor_pos = vec3.create();
        for (const face of FACES_LIST) {
            checkVoxelFaceIntersections(
                exit_voxel != null ?
                    exit_voxel.getNeighbor(face) : this.world_data.getNeighborForOutOfWorldVoxelPointer(segment_end, face),
                vec3.add(neighbor_pos, segment_end, face.vec_relative));
        }
        for (const face of FACES_LIST) {
            checkVoxelFaceIntersections(
                start_voxel != null ?
                    start_voxel.getNeighbor(face) : this.world_data.getNeighborForOutOfWorldVoxelPointer(segment_start, face),
                vec3.add(neighbor_pos, segment_start, face.vec_relative));
        }

        return nearest_collision;
    }

    private get_state_for_pos(ref_position: vec3): RayCasterState<TChunk, TVoxel> {
        const pointer = this.world_data.getVoxelPointer(ref_position);
        return pointer != null ?
            { type: "tracking", position: ref_position, pointer } :
            { type: "floating", position: ref_position };
    }

    /**
     * @desc The position of the ray in world space.
     */
    get ref_ray_position(): vec3 {
        return this.state.position;
    }

    set ref_ray_position(ref_position: vec3) {
        this.state = this.get_state_for_pos(ref_position);
    }

    refreshSeekPosition() {
        this.state = this.get_state_for_pos(this.ref_ray_position);
    }
}