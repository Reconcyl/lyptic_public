import {ClientEntityTickingContext, IClientEntity} from "../base/clientEntityInterfaces";
import {mat4, vec3} from "gl-matrix";
import {FpsSpatialController} from "../../../../../../../voxel-engine/rendering-core/fpsSpatialController";
import {FpsPawnController} from "../../../../../../shared/gameplay/entities/fpsPawnController";
import {VoxelRigidBodyController} from "../../../../../../../voxel-engine/voxel-data/voxelRigidBodyController";
import {SharedPlayerController} from "../../../../../../shared/gameplay/entities/sharedPlayerController";
import {ClientBatchRenderingCtx} from "../base/batchRendering";
import {SharedHpController} from "../../../../../../shared/gameplay/entities/sharedHpController";
import {ItemTypeSwordBehaviorDefinition} from "../../../../../../shared/gameplay/data/itemTypes";

export class ClientEntityBob implements IClientEntity {
    private readonly hp_controller: SharedHpController = new SharedHpController(20, 20);
    private readonly movement_controller: FpsPawnController;
    private hit_cool_down = 0;
    private next_frame_jump = false;

    constructor(public readonly spatial: FpsSpatialController) {
        this.movement_controller = new FpsPawnController(new VoxelRigidBodyController(this.spatial.origin));
    }

    generateTransform(ctx: ClientBatchRenderingCtx): mat4 {
        const transform = this.spatial.generateTransform();
        mat4.translate(transform, transform, [0, -1.6, 0]);
        return transform;
    }

    onTick({ world }: ClientEntityTickingContext) {
        const heading = vec3.sub(vec3.create(), world.local_player.fps_camera.position, this.spatial.origin);
        this.spatial.pitch = this.spatial.getPitchAngleTo(world.local_player.fps_camera.position);

        if (this.hit_cool_down > 0) this.hit_cool_down--;

        if (vec3.len(heading) < 1) {
            this.next_frame_jump = false;
            if (this.hit_cool_down <= 0) {
                const velocity = world.local_player.player_base.fps_controller.velocity;
                vec3.normalize(heading, heading);
                heading[1] = 0.1;
                vec3.add(velocity, velocity, vec3.scale(heading, heading, 2));
                this.hit_cool_down = 20;
                world.local_player.player_base.health_controller.modifyHealth(-2);
                world.local_player.notifyHealthUpdate();
            }
        } else {
            heading[1] = 0;

            const feedback = this.movement_controller.tick(world.world_data, vec3.len(heading) < 10 ? vec3.normalize(heading, heading) : [0, 0, 0], this.next_frame_jump, SharedPlayerController.physics_config,
                pointer => pointer?.hasVoxel() || false);

            this.next_frame_jump = feedback.prevented[0] || feedback.prevented[2];
        }
    }

    isColliding(other: vec3): boolean {
        return vec3.squaredDistance(this.spatial.origin, other) <= 2**2;
    }

    hitByPlayer(ctx: ClientEntityTickingContext, type: ItemTypeSwordBehaviorDefinition, knock_dir: vec3) {
        const {world} = ctx;
        this.hp_controller.modifyHealth(-type.damage);
        const velocity = this.movement_controller.velocity;
        knock_dir[1] = 0.1;
        vec3.add(velocity, velocity, knock_dir);
        if (this.hp_controller.isDead()) {
            world.entities_renderer.unregisterEntity(world.entity_rendering_buckets.ent_bob, this);
        }
    }
}