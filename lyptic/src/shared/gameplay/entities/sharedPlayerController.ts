import {clamp} from "../../../../voxel-engine/utils/scalar";
import {ITEM_ID_TO_TYPE, ItemTypeDefinition, ItemTypeId} from "../data/itemTypes";
import {vec3} from "gl-matrix";
import {FpsPawnController, FpsPawnPhysicalConfig} from "./fpsPawnController";
import {VoxelRigidBodyController} from "../../../../voxel-engine/voxel-data/voxelRigidBodyController";
import {VoxelWorldData} from "../../../../voxel-engine/voxel-data/voxelWorldData";
import {IVoxelChunkDataWrapper, VoxelChunkPointer} from "../../../../voxel-engine/voxel-data/voxelChunkData";
import {SharedHpController} from "./sharedHpController";

export type InventoryModifiedSlot<TItemStack extends ISharedItemStackWrapper> = {
    idx: number,
    stack: TItemStack,
    type_changed: boolean
};
export type InventoryInsertionResult<TItemStack extends ISharedItemStackWrapper> = {
    did_fully_insert: boolean,
    modified_slots: InventoryModifiedSlot<TItemStack>[]
};

export type PlayerTickResult = {
    health_updated: boolean
};

export class SharedPlayerController<TItemStack extends ISharedItemStackWrapper> {
    public static readonly inventory_size: number = 4 * 9;
    public static readonly physics_config: FpsPawnPhysicalConfig = {
        friction_horizontal: 0.75,
        friction_vertical: 1,

        magnitude_jump: 0.25,
        magnitude_heading: 0.055,
        magnitude_gravity: 0.023,

        collision_checking_points: [
            [-0.25, 0.3, -0.25],
            [ 0.25, 0.3, -0.25],
            [-0.25, 0.3,  0.25],
            [ 0.25, 0.3,  0.25],

            [-0.25, -1.6, -0.25],
            [ 0.25, -1.6, -0.25],
            [-0.25, -1.6,  0.25],
            [ 0.25, -1.6,  0.25],

            [-0.25, -0.6, -0.25],
            [ 0.25, -0.6, -0.25],
            [-0.25, -0.6,  0.25],
            [ 0.25, -0.6,  0.25],
        ],

        jump_land_cool_down: 2
    };

    // Properties
    public readonly health_controller: SharedHpController;
    private time_since_last_heal = 0;
    public readonly inventory: (TItemStack | null)[] = new Array(SharedPlayerController.inventory_size).fill(null);
    public hot_bar_slot = 0;
    public readonly fps_controller: FpsPawnController;
    private fall_height: null | number = null;

    constructor(initial_health: number, public readonly ref_position: vec3) {
        this.health_controller = new SharedHpController(initial_health, 20);
        this.fps_controller = new FpsPawnController(  // Note: ref_position is eye height!  TODO: Maybe don't do this??
            new VoxelRigidBodyController(ref_position));
    }

    // Inventory sub-module
    insertItem(inserted_stack: TItemStack): InventoryInsertionResult<TItemStack> {
        let idx = 0;
        const modified_stacks: InventoryModifiedSlot<TItemStack>[] = [];

        for (const other_stack_wrapped of this.inventory) {
            if (other_stack_wrapped == null) {
                modified_stacks.push({
                    idx, stack: inserted_stack,
                    type_changed: true
                });
                this.inventory[idx] = inserted_stack;
                return { did_fully_insert: true, modified_slots: modified_stacks };
            } else {
                const other_stack = other_stack_wrapped.shared_item_stack;
                const consumption_result = other_stack.tryToConsume(inserted_stack.shared_item_stack);
                if (consumption_result === "amalgamated") {
                    modified_stacks.push({
                        idx, stack: other_stack_wrapped,
                        type_changed: false
                    });
                    return { did_fully_insert: true, modified_slots: modified_stacks };
                } else if (consumption_result === "modified") {
                    modified_stacks.push({
                        idx, stack: other_stack_wrapped,
                        type_changed: false
                    });
                }
            }
            idx++;
        }

        return { did_fully_insert: false, modified_slots: modified_stacks };
    }

    moveItem(from_slot: number, to_slot: number): void {
        const from_stack = this.inventory[from_slot];
        const to_stack = this.inventory[to_slot];
        if (from_stack == null) return;

        if (to_stack?.shared_item_stack.type_id === from_stack.shared_item_stack.type_id) {
            const stack_result = to_stack.shared_item_stack.tryToConsume(from_stack.shared_item_stack);
            if (stack_result === "amalgamated") {
                this.inventory[from_slot] = null;
            }
        } else {
            this.inventory[to_slot] = from_stack;
            this.inventory[from_slot] = to_stack;
        }
    }

    consumeItem(stack_slot: number, stack_obj: TItemStack, amount: number): TItemStack | null {
        const stack_obj_nowrap = stack_obj.shared_item_stack;
        stack_obj_nowrap.count -= amount;
        if (stack_obj_nowrap.count > 0) return stack_obj;
        this.inventory[stack_slot] = null;
        return null;
    }

    get selected_item(): TItemStack | null {
        return this.inventory[this.hot_bar_slot];
    }

    // Shared sub-module
    tick<TChunk extends IVoxelChunkDataWrapper<TChunk, TVoxel>, TVoxel>(
            world_data: VoxelWorldData<TChunk, TVoxel>, heading: vec3, jumping: boolean, is_solid: (pointer: VoxelChunkPointer<TChunk, TVoxel> | null) => boolean): PlayerTickResult {
        const result: PlayerTickResult = { health_updated: false };

        // Effects & hp
        if (this.health_controller.raw_health < this.health_controller.max_health) {
            if (this.time_since_last_heal < 500) {
                this.time_since_last_heal++;
            } else {
                this.time_since_last_heal = 0;
                this.health_controller.modifyHealth(1);
                result.health_updated = true;
            }
        }

        // Physics
        const from_y = this.ref_position[1];
        const move_feedback = this.fps_controller.tick(world_data, heading, jumping, SharedPlayerController.physics_config, is_solid);

        if (move_feedback.prevented[1] && this.fps_controller.velocity[1] < 0) {  // Is on ground
            if (this.fall_height != null) {
                if (this.fall_height > 3) {
                    this.health_controller.modifyHealth(-Math.floor(this.fall_height - 3));
                    result.health_updated = true;
                }
                this.fall_height = null;
            }
        } else {
            if (this.fall_height == null) this.fall_height = 0;
            const y_down_delta = from_y - this.ref_position[1];
            if (y_down_delta >= 0) {
                this.fall_height += y_down_delta;
            }
        }

        if (this.ref_position[1] < -25) {
            this.health_controller.modifyHealth(-3);
            result.health_updated = true;
        }

        return result;
    }
}

// Inventory stuff
export interface ISharedItemStackWrapper {
    shared_item_stack: SharedItemStack
}

export class SharedItemStack implements ISharedItemStackWrapper {
    constructor(public readonly type_id: ItemTypeId, public count: number) {}

    get type_definition(): ItemTypeDefinition {
        return ITEM_ID_TO_TYPE[this.type_id];
    }

    /**
     * @desc Returns true if the other stack got entirely consumed.
     */
    tryToConsume(other: SharedItemStack): "denied" | "modified" | "amalgamated" {
        if (other.type_id != this.type_id) return "denied";
        const consumed_amount = Math.min(other.count, this.type_definition.max_count - this.count);
        this.count += consumed_amount;
        other.count -= consumed_amount;
        return other.count <= 0 ? "amalgamated" : "modified";
    }

    get shared_item_stack(): SharedItemStack {
        return this;
    }
}