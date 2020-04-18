// Welcome to attempt number 1675309 of NaN for properly implementing collisions with ray casters.
// Enjoy your stay!
import {vec3} from "gl-matrix";
import {IVoxelChunkDataWrapper, VoxelChunkPointer} from "./voxelChunkData";
import {VoxelWorldData} from "./voxelWorldData";
import {AXIS_INDICES} from "./faces";
import {VoxelRayCaster} from "./voxelRayCaster";

export type VoxelRigidBodyMoveFeedback = {
    prevented: [boolean, boolean, boolean]
};
export class VoxelRigidBodyController {
    constructor(public ref_position: vec3) {}

    moveAndSlide<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel>(
                world_data: VoxelWorldData<TChunk, TVoxel>, total_delta: vec3, volume_checking_points: Iterable<vec3>,
                is_solid: (pointer: VoxelChunkPointer<TChunk, TVoxel> | null) => boolean): VoxelRigidBodyMoveFeedback {
        // Get vectors
        const {ref_position} = this;
        const VOXEL_MARGIN = 0.02;
        const move_feedback: VoxelRigidBodyMoveFeedback = {
            prevented: [false, false, false]
        }

        // Create reusable objects
        const ray_cast_lookup_vec = vec3.create();
        const ray_cast = new VoxelRayCaster(world_data, ray_cast_lookup_vec);
        const ray_cast_dt = vec3.create();

        // Update axes
        for (const axis_idx of AXIS_INDICES) {
            // Figure out axis direction
            const axis_sign = Math.sign(total_delta[axis_idx]);
            if (axis_sign == 0) continue;  // Early return if no motion occurs on that axis.
            ray_cast_dt[axis_idx] = axis_sign;

            // Figure out the limit for movement in this axis
            let limit_ws: null | number = null;
            for (const vc_relative of volume_checking_points) {
                // Reset ray caster
                vec3.add(ray_cast_lookup_vec, ref_position, vc_relative);
                ray_cast.refreshSeekPosition();

                // Determine axis' limits;
                for (let x = 0; x < Math.abs(total_delta[axis_idx]); x++) {
                    // Check for collision
                    const hit_voxel = ray_cast.stepVoxel(ray_cast_dt);
                    if (!is_solid(hit_voxel)) continue;

                    // We hit something and are thus limited
                    const collision_on_axis = Math.floor(ray_cast.ref_ray_position[axis_idx]) + (axis_sign == 1 ? 0 : 1);
                    const new_limit_ws = collision_on_axis - vc_relative[axis_idx];
                    if (limit_ws == null || (
                        axis_sign > 0 ?
                            new_limit_ws < limit_ws :
                            new_limit_ws > limit_ws
                    )) {
                        limit_ws = new_limit_ws;
                    }
                    break;
                }
            }

            // Update the position on that axis.
            if (limit_ws == null) {
                ref_position[axis_idx] += total_delta[axis_idx]
            } else {
                if (axis_sign < 0) {
                    const cap = limit_ws + VOXEL_MARGIN;
                    const val = ref_position[axis_idx] + total_delta[axis_idx];
                    // => Math.max(cap, val)
                    if (cap > val) {  // Limit
                        ref_position[axis_idx] = cap;
                        move_feedback.prevented[axis_idx] = true;
                    } else {  // Allow
                        ref_position[axis_idx] = val;
                    }
                } else {
                    const cap = limit_ws - VOXEL_MARGIN;
                    const val = ref_position[axis_idx] + total_delta[axis_idx];
                    // => Math.min(cap, val)
                    if (cap < val) {  // Limit
                        ref_position[axis_idx] = cap;
                        move_feedback.prevented[axis_idx] = true;
                    } else {  // Allow
                        ref_position[axis_idx] = val;
                    }
                }
            }

            ray_cast_dt[axis_idx] = 0;  // Ensure the ray_cast_dt ends up being [0, 0, 0]
        }

        return move_feedback;
    }
}