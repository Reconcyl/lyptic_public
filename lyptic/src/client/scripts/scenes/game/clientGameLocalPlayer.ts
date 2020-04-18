import {vec2, vec3} from "gl-matrix";
import {FpsCameraController} from "../../../../../voxel-engine/rendering-core/fpsCameraController";
import {clamp, deg2rad, signedModulo} from "../../../../../voxel-engine/utils/scalar";
import {ClientEngine} from "../engine/clientEngine";
import {
    InventoryInsertionResult,
    SharedItemStack,
    SharedPlayerController
} from "../../../../shared/gameplay/entities/sharedPlayerController";
import {ClientGuiRoot} from "./ui/clientGuiRoot";
import {ClientGuiItemStack} from "./ui/clientGuiItemStack";
import {ClientGuiHotBar} from "./ui/clientGuiHotBar";
import {ClientGuiInventory} from "./ui/clientGuiInventory";
import {VoxelRayCaster} from "../../../../../voxel-engine/voxel-data/voxelRayCaster";
import {
    ItemBehaviorTypes,
    ItemTypeId,
    ItemTypeSwordBehaviorDefinition,
} from "../../../../shared/gameplay/data/itemTypes";
import {VoxelChunkPointer} from "../../../../../voxel-engine/voxel-data/voxelChunkData";
import {ClientGameChunk} from "./clientGameChunk";
import {BlockType} from "../../../../shared/gameplay/data/blockIds";
import {FpsSpatialController} from "../../../../../voxel-engine/rendering-core/fpsSpatialController";
import {ClientGuiPauseMenu} from "./ui/clientGuiPauseMenu";
import {ClientMenuRoot} from "../menu/clientMenuRoot";
import {GOOD_CRATE_LOOT_TABLE, NORMAL_CRATE_LOOT_TABLE} from "../../../../shared/gameplay/data/crateRewards";
import {ClientEntityTickingContext} from "./entities/base/clientEntityInterfaces";

export class ClientGameLocalPlayer {
    public readonly player_base: SharedPlayerController<SharedItemStack>;
    public readonly fps_camera: FpsCameraController;
    public readonly gui_controller: ClientGuiRoot;
    public break_status: null | { target: VoxelChunkPointer<ClientGameChunk, BlockType>, started_break: number, breaks_at: number } = null;
    private death_end_counter = 0;
    private hit_cool_down = 0;
    private health_updated_frame = false;

    constructor(engine: ClientEngine, spawn_position: vec3) {
        // Construct camera
        this.fps_camera = new FpsCameraController({
            clipping_near: 0.01,
            clipping_far: 1000,
            fov_rad: deg2rad(90),
            aspect: engine.canvas.width / engine.canvas.height
        }, new FpsSpatialController(spawn_position, 0, 0));

        // Create player
        this.player_base = new SharedPlayerController<SharedItemStack>(20, spawn_position);
        this.player_base.insertItem(new SharedItemStack(ItemTypeId.stone_block, 10));
        this.player_base.insertItem(new SharedItemStack(ItemTypeId.shovel, 1));
        this.player_base.insertItem(new SharedItemStack(ItemTypeId.dagger, 1));
        this.player_base.insertItem(new SharedItemStack(ItemTypeId.medkit, 1));

        // Catchup & create GUI
        const hot_bar_slots: ClientGuiItemStack[] = [];
        const inventory_slots: ClientGuiItemStack[] = [];
        for (let idx = 0; idx < this.player_base.inventory.length; idx++) {
            const stack = this.player_base.inventory[idx];
            const stack_texture = stack?.type_definition.image_idx;
            const stack_count = stack?.count || 0;

            if (idx < 9) hot_bar_slots.push(new ClientGuiItemStack(stack_texture === undefined ? null : stack_texture, stack_count));
            inventory_slots.push(new ClientGuiItemStack(stack_texture === undefined ? null : stack_texture, stack_count));
        }

        this.gui_controller = new ClientGuiRoot(
            null,
            new ClientGuiHotBar(this.getHealthPercent(), this.player_base.hot_bar_slot, hot_bar_slots),
            new ClientGuiInventory(inventory_slots, slot => this.player_base.inventory[slot], this.moveStacks.bind(this)),
            new ClientGuiPauseMenu(() => this.closeAllGUIs(), () => {
                this.quitGame(engine);
            })
        );
    }

    // GUI actions
    private insertItem(stack: SharedItemStack): InventoryInsertionResult<SharedItemStack> {
        const result = this.player_base.insertItem(stack);
        for (const modified_slot of result.modified_slots) {
            function applyToGuiStack(stack: ClientGuiItemStack) {
                stack.updateCount(modified_slot.stack.count);
                if (modified_slot.type_changed)
                    stack.updateIcon(modified_slot.stack.type_definition.image_idx);
            }
            if (modified_slot.idx < 9) applyToGuiStack(this.gui_controller.hot_bar.item_stacks[modified_slot.idx]);
            applyToGuiStack(this.gui_controller.inventory_menu.item_stacks[modified_slot.idx]);
        }
        return result;
    }

    private moveStacks(from_idx: number, to_idx: number) {
        this.player_base.moveItem(from_idx, to_idx);  // TODO: Optimize state changes
        this.updateItemStack(this.player_base.inventory[from_idx], from_idx);
        this.updateItemStack(this.player_base.inventory[to_idx], to_idx);
    }

    private updateItemStack(data: SharedItemStack | null, slot: number) {
        const icon = data === null ? null : data.type_definition.image_idx;
        const count = data === null ? 0 : data.count;

        if (slot < 9) {
            const item = this.gui_controller.hot_bar.item_stacks[slot];
            item.updateIcon(icon);
            item.updateCount(count);
        }

        const item = this.gui_controller.inventory_menu.item_stacks[slot];
        item.updateIcon(icon);
        item.updateCount(count);
    }

    private consumeItem(slot: number, stack: SharedItemStack, amount: number) {
        this.updateItemStack(this.player_base.consumeItem(slot, stack, amount), slot);
    }

    private openPauseMenu() {
        this.gui_controller.setActiveGui("pause");
        ClientGameLocalPlayer.setPointerLockState(false);
    }

    private closeAllGUIs() {
        this.gui_controller.setActiveGui(null);
        queueMicrotask(() => ClientGameLocalPlayer.setPointerLockState(true));
    }

    // Shared actions
    private cancelBreak() {
        this.break_status = null;
    }

    private quitGame(engine: ClientEngine) {
        engine.swapScene(engine => new ClientMenuRoot(engine));
    }

    private getHealthPercent() {
        const {health_controller} = this.player_base;
        return health_controller.raw_health / health_controller.max_health * 100;
    }

    notifyHealthUpdate() {
        this.health_updated_frame = true;
    }

    // Event handling
    onUpdate(ctx: ClientEntityTickingContext) {
        const {engine, world} = ctx;
        const current_view = this.gui_controller.active_view;

        // Generate movement heading
        let heading_ws_vec: vec3;
        if (current_view === null) {
            const heading_input = vec2.create();  // (strafe, up/down, forward)
            if (engine.input_service.isActionPressed("move_forward")) heading_input[1] += 1;
            if (engine.input_service.isActionPressed("move_backward")) heading_input[1] -= 1;
            if (engine.input_service.isActionPressed("move_strafe_left")) heading_input[0] -= 1;
            if (engine.input_service.isActionPressed("move_strafe_right")) heading_input[0] += 1;

            const camera_dir = this.fps_camera.view_state.getDirectionHorizontal();
            heading_ws_vec = [
                camera_dir[0] * heading_input[1] - camera_dir[1] * heading_input[0],
                0,
                camera_dir[1] * heading_input[1] + camera_dir[0] * heading_input[0]
            ];
            vec3.normalize(heading_ws_vec, heading_ws_vec);
        } else {
            heading_ws_vec = [0, 0, 0];
        }

        // Update player
        const result = this.player_base.tick(world.world_data, heading_ws_vec,
            current_view === null && engine.input_service.isActionPressed("move_jump"), world.isVoxelSolid);
        if (result.health_updated || this.health_updated_frame) {
            this.gui_controller.hot_bar.setHealthPercent(this.getHealthPercent());
        }
        this.health_updated_frame = false;

        if (current_view !== "death") {
            if (this.player_base.health_controller.isDead()) {
                this.gui_controller.setActiveGui("death");
                ClientGameLocalPlayer.setPointerLockState(false);
            }
        } else {
            this.death_end_counter += 1;
            if (this.death_end_counter > 300) {
                ClientGameLocalPlayer.setPointerLockState(false);
                this.quitGame(engine);
                return;
            }
        }

        // Menu toggling
        if (engine.input_service.wasActionJustPressed("inv_toggle_view")) {
            if (current_view === "inventory") {
                this.closeAllGUIs();
            } else if (current_view === null) {
                this.gui_controller.setActiveGui("inventory");
                ClientGameLocalPlayer.setPointerLockState(false);
            }
        }

        if (engine.input_service.wasActionJustPressed("pause_menu")) {
            if (current_view !== "pause") {
                this.openPauseMenu();
            }
        }

        // Tick UI
        this.gui_controller.tick();

        // Inventory in-game actions
        if (this.hit_cool_down > 0) this.hit_cool_down--;
        if (current_view === null) {
            // Hot bar selecting
            for (let idx = 0; idx < 9; idx++) {
                if (engine.input_service.wasActionJustPressed("inv_hot_" + idx as any)) {
                    const from_slot = this.player_base.hot_bar_slot;
                    this.player_base.hot_bar_slot = idx;
                    this.gui_controller.hot_bar.selectedSlotChanged(from_slot, idx);
                }
            }

            // Using items
            const interaction_result = this.handleInteractionOnTick(ctx);
            if (this.break_status != null && interaction_result !== "breaking")
                this.cancelBreak();
        }
    }

    private handleInteractionOnTick(ctx: ClientEntityTickingContext): "nothing" | "placed" | "broken" | "breaking" {
        const {engine, world} = ctx;
        const camera_dir = this.fps_camera.view_state.getDirection();
        const rayCast = (range: number, additional_logic: null | ((position: vec3) => boolean) = null) => {
            const ray_caster = new VoxelRayCaster(world.world_data, vec3.clone(this.player_base.ref_position));
            for (let x = 0; x < range; x++) {
                const collision = ray_caster.step(
                    camera_dir, (collision) => world.isVoxelSolid(collision.collided_voxel));

                if ((additional_logic != null && additional_logic(ray_caster.ref_ray_position)) || collision !== null) {
                    return collision;
                }
            }
            return null;
        }

        const current_item = this.player_base.selected_item;
        if (current_item == null) return "nothing";
        const item_type_def = current_item.type_definition;

        if (item_type_def.behavior.type === ItemBehaviorTypes.Block) {
            if (!engine.input_service.wasActionJustPressed("interact")) return "nothing";

            const collision = rayCast(8);
            if (collision == null) return "nothing";

            const target = collision.collided_voxel!.getNeighbor(collision.face);
            if (target !== null && !target.hasVoxel()) {
                // Update map
                target.setData(item_type_def.behavior.place_id);
                target.chunk_wrapped.updateVoxel(engine.gl, target.ref_pos);

                // Use item
                this.consumeItem(this.player_base.hot_bar_slot, current_item, 1);

                return "placed";
            }
        } else if (item_type_def.behavior.type === ItemBehaviorTypes.Pick) {
            if (!engine.input_service.isActionPressed("interact")) return "nothing";

            // Look for a valid block
            const collision = rayCast(8);
            if (collision == null) return "nothing";
            const target = collision.collided_voxel!;

            const target_data = target.getData();
            if (target_data == null) return "nothing";

            // Handle the breaking of that block
            if (this.break_status == null) {
                // Check if we can break the block
                const durability = item_type_def.behavior.damage[target_data];
                if (durability == null) return "nothing";

                // Start breaking the block
                this.break_status = { target, started_break: Date.now(), breaks_at: Date.now() + durability };
                return "breaking";
            } else {
                // Cancel the break if we've moved on to another block
                if (!this.break_status.target.equals(target)) {
                    this.cancelBreak();
                    return "nothing";
                }

                // Break the block if we've mined it sufficiently.
                if (this.break_status.breaks_at < Date.now()) {
                    let data = target.getData();
                    if (data === BlockType.CRATE) {
                        this.insertItem(NORMAL_CRATE_LOOT_TABLE.sample());
                    } else if (data === BlockType.GOOD_CRATE) {
                        this.insertItem(GOOD_CRATE_LOOT_TABLE.sample());
                    }
                    target.removeVoxel();
                    target.chunk_wrapped.updateVoxel(engine.gl, target.ref_pos);
                    this.break_status = null;
                    return "broken";
                }

                return "breaking";
            }
        } else if (item_type_def.behavior.type === ItemBehaviorTypes.Sword) {
            if (!engine.input_service.wasActionJustPressed("interact")) return "nothing";
            if (this.hit_cool_down > 0) return "nothing";
            rayCast(item_type_def.behavior.range, position => {
               for (const enemy of world.entities_renderer.iterateEntities()) {
                    if (enemy.isColliding(position)) {
                        const behavior = item_type_def.behavior as ItemTypeSwordBehaviorDefinition;
                        enemy.hitByPlayer(ctx, behavior, camera_dir);
                        this.hit_cool_down = behavior.cool_down;
                        return true;
                    }
               }

               return false;
            });

            return "nothing";
        } else if (item_type_def.behavior.type === ItemBehaviorTypes.Action) {
            if (!engine.input_service.wasActionJustPressed("interact")) return "nothing";
            item_type_def.behavior.handler(ctx);
            this.consumeItem(this.player_base.hot_bar_slot, current_item, 1);
        }

        return "nothing";
    }

    onMouseMove(e: MouseEvent) {
        if (this.gui_controller.active_view != null) return;
        const view_state = this.fps_camera.view_state;
        const sensitivity = -0.005;
        view_state.pitch = signedModulo(view_state.pitch + e.movementX * sensitivity, Math.PI * 2);
        view_state.yaw = clamp(view_state.yaw + e.movementY * sensitivity, -Math.PI / 2, Math.PI / 2);
    }

    onPointerLockLost() {
        if (this.gui_controller.active_view === null)
            this.openPauseMenu();
    }

    // Pointer lock garbage
    getDesiredPointerState(): boolean {
        return this.gui_controller.active_view === null;
    }

    static setPointerLockState(state: boolean) {
        if (state) {
            document.body.requestPointerLock();
        } else {
            document.exitPointerLock();
        }
    }

    static getPointerLockState() {
        return document.pointerLockElement === document.body;
    }
}