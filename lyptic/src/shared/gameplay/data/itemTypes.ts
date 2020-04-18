import {BlockType} from "./blockIds";
import {ClientEntityTickingContext} from "../../../client/scripts/scenes/game/entities/base/clientEntityInterfaces";

export enum ItemBehaviorTypes {
    Pick,
    Sword,
    Block,
    Action
}

export type ItemTypeDefinition = {
    max_count: number,
    name: string,
    image_idx: number,

    behavior: {
        type: ItemBehaviorTypes.Pick,
        damage: { [id: number]: number }
    } | {
        type: ItemBehaviorTypes.Block,
        place_id: BlockType,
    } | {
        type: ItemBehaviorTypes.Action,
        handler: (ctx: ClientEntityTickingContext) => void
    } | ItemTypeSwordBehaviorDefinition
};

export type ItemTypeSwordBehaviorDefinition = {
    type: ItemBehaviorTypes.Sword,
    damage: number,
    range: number,
    cool_down: number
};

export enum ItemTypeId {
    stone_block,
    shovel,
    dagger,
    medkit,
}

export const ITEM_ID_TO_TYPE: Record<ItemTypeId, ItemTypeDefinition> = {
    [ItemTypeId.stone_block]: {
        name: "Cracked brick",
        max_count: 64,
        image_idx: 0,
        behavior: {
            type: ItemBehaviorTypes.Block,
            place_id: BlockType.CRACKED_BRICK_1
        }
    },
    [ItemTypeId.shovel]: {
        name: "Shovel",
        max_count: 1,
        image_idx: 1,
        behavior: {
            type: ItemBehaviorTypes.Pick,
            damage: {
                [BlockType.GRASS]: 200,
                [BlockType.DIRT]: 200,
                [BlockType.CRACKED_BRICK_1]: 3000,
                [BlockType.CRACKED_BRICK_2]: 3500,
                [BlockType.CRATE]: 1000,
                [BlockType.GOOD_CRATE]: 1000,
                [BlockType.SPIKE_1]: 3000,
                [BlockType.SPIKE_2]: 3000,
                [BlockType.SPIKE_TOP]: 3000
            }
        }
    },
    [ItemTypeId.dagger]: {
        name: "Dagger",
        max_count: 1,
        image_idx: 2,
        behavior: {
            type: ItemBehaviorTypes.Sword,
            damage: 3,
            range: 3,
            cool_down: 20,
        }
    },
    [ItemTypeId.medkit]: {
        name: "Medical Kit",
        max_count: 16,
        image_idx: 3,
        behavior: {
            type: ItemBehaviorTypes.Action,
            handler(ctx) {
                ctx.world.local_player.player_base.health_controller.modifyHealth(10);
                ctx.world.local_player.notifyHealthUpdate();
            }
        }
    }
};