import {ItemTypeId} from "./itemTypes";
import {SharedItemStack} from "../entities/sharedPlayerController";

function randBetween(a: number, b: number) {
    return Math.floor(Math.random() * (b - a)) + a;
}

type RewardVariant = {
    type: ItemTypeId,
    // the minimum possible item value (inclusive)
    min_count: number,
    // the maximum possible item value (exclusive)
    max_count: number,
}

export class LootTable {
    private variants: [number, RewardVariant][];
    private total_weight: number;

    constructor() {
        this.variants = [];
        this.total_weight = 0;
    }

    addVariant(weight: number, variant: RewardVariant) {
        this.variants.push([weight, variant]);
        this.total_weight += weight;
    }

    sample() {
        if (this.total_weight == 0) {
            throw "nothing to sample from";
        }
        const s = Math.random() * this.total_weight;
        let weight_so_far = 0;
        for (let [weight, variant] of this.variants) {
            weight_so_far += weight;
            if (weight_so_far > s) {
                const qty = randBetween(variant.min_count, variant.max_count);
                return new SharedItemStack(variant.type, qty);
            }
        }
        throw "impossible";
    }
}

function getNormalCrateLootTable() {
    const table = new LootTable();
    table.addVariant(3, {
        type: ItemTypeId.stone_block,
        min_count: 2,
        max_count: 6,
    });
    table.addVariant(1, {
        type: ItemTypeId.shovel,
        min_count: 1,
        max_count: 2,
    });
    table.addVariant(1, {
        type: ItemTypeId.dagger,
        min_count: 1,
        max_count: 2,
    });
    table.addVariant(2, {
        type: ItemTypeId.medkit,
        min_count: 1,
        max_count: 2,
    });
    return table;
}

function getGoodCrateLootTable() {
    const table = new LootTable();
    table.addVariant(1, {
        type: ItemTypeId.stone_block,
        min_count: 32,
        max_count: 65,
    });
    table.addVariant(2, {
        type: ItemTypeId.medkit,
        min_count: 3,
        max_count: 6,
    });
    return table;
}

export const NORMAL_CRATE_LOOT_TABLE = getNormalCrateLootTable();
export const GOOD_CRATE_LOOT_TABLE = getGoodCrateLootTable();