import {
    VoxelRigidBodyController,
    VoxelRigidBodyMoveFeedback
} from "../../../../voxel-engine/voxel-data/voxelRigidBodyController";
import {vec3} from "gl-matrix";
import {VoxelWorldData} from "../../../../voxel-engine/voxel-data/voxelWorldData";
import {IVoxelChunkDataWrapper, VoxelChunkPointer} from "../../../../voxel-engine/voxel-data/voxelChunkData";

export type FpsPawnPhysicalConfig = {
    friction_horizontal: number,
    friction_vertical: number,

    magnitude_jump: number,
    magnitude_gravity: number,
    magnitude_heading: number,

    jump_land_cool_down: number,
    collision_checking_points: Iterable<vec3>
};

export class FpsPawnController {
    public readonly velocity: vec3 = vec3.create();
    private ticks_till_jump: number = 0;

    constructor(private readonly rigid_body_controller: VoxelRigidBodyController) {}

    tick<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel>(
        world_data: VoxelWorldData<TChunk, TVoxel>, input_heading: vec3, input_jump_pressed: boolean,
        physical_config: FpsPawnPhysicalConfig, is_solid: (pointer: VoxelChunkPointer<TChunk, TVoxel> | null) => boolean)
    {
        const move_feedback = this.rigid_body_controller.moveAndSlide(world_data, this.velocity,
            physical_config.collision_checking_points, is_solid);

        // Horizontal handling
        vec3.add(this.velocity, this.velocity, vec3.scale(vec3.create(), input_heading, physical_config.magnitude_heading));
        this.velocity[0] *= physical_config.friction_horizontal;
        this.velocity[2] *= physical_config.friction_horizontal;

        // Vertical handling
        if (move_feedback.prevented[1] && this.velocity[1] < 0) {  // On ground
            this.velocity[1] = -0.001;
            if (this.ticks_till_jump > 0) {
                this.ticks_till_jump--;
            } else if (input_jump_pressed) {
                this.velocity[1] = physical_config.magnitude_jump;
            }
        } else {  // Not on ground
            if (move_feedback.prevented[1]) {  // Bonk!
                this.velocity[1] = 0;
            } else {  // Apply gravity!
                this.ticks_till_jump = physical_config.jump_land_cool_down;
                this.velocity[1] -= physical_config.magnitude_gravity;
                this.velocity[1] *= physical_config.friction_vertical;
            }
        }

        return move_feedback;
    }
}