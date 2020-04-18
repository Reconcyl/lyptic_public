import seedrandom = require("seedrandom");
import Noise = require("noisejs/index.js");
import {vec2, vec3} from "gl-matrix";
import {ClientGameChunk} from "../../client/scripts/scenes/game/clientGameChunk";
import {CHUNK_BLOCK_COUNT} from "../../../voxel-engine/voxel-data/faces";
import {mod, range, zero_at_edges} from "./utils";
import {BlockType} from "../gameplay/data/blockIds";

// The number of chunks in a region.
const REGION_CHUNKS = 5;
// The width of a city block. Subtract 4 to account for main roads.
const BLOCK_WIDTH = REGION_CHUNKS * CHUNK_BLOCK_COUNT - 4;

class WorldgenRegion {
    public readonly block_type: number;
    public readonly terrain_noise: Noise | null;
    public readonly terrain_height: number;
    public readonly placement_map: boolean[] | null;
    public readonly transpose_placement_map: boolean;
    public readonly spikes: Map<number, [BlockType, number]>;
    public readonly buildings: Map<number, [number, number, Building]>;

    private readonly rng: seedrandom.prng;

    constructor(region_seed: string) {
        this.rng = seedrandom(region_seed);
        this.block_type = Math.floor(this.rng.double() * 4);
        this.spikes = new Map();
        this.buildings = new Map();
        if (this.rng.double() < 0.1) {
            // This region is a park.
            this.terrain_noise = new Noise.Noise(this.rng.double());
            this.terrain_height = 2 + 14 * this.rng.double();
            this.placement_map = null;
            this.transpose_placement_map = false;
        } else {
            // This region is a city block.
            this.terrain_noise = null;
            this.terrain_height = 0;

            this.placement_map = Array(BLOCK_WIDTH * BLOCK_WIDTH).fill(false);
            this.transpose_placement_map = this.rng.double() < 0.5;
            const amp = this.rng.double() * 3;
            const lam = 0.2 / amp;
            const z_offset = (this.rng.double() - 0.5) * 30;
            for (let x = 0; x < BLOCK_WIDTH; x++) {
                let z = Math.floor(
                    BLOCK_WIDTH / 2
                    + z_offset
                    + amp * Math.sin(x * lam));
                this.placement_map[z * BLOCK_WIDTH + x] = true;
                this.placement_map[(z - 1) * BLOCK_WIDTH + x] = true;
                if (this.rng.double() < 0.5) {
                    this.placement_map[(z - 2) * BLOCK_WIDTH + x] = true;
                }
                if (this.rng.double() < 0.5) {
                    this.placement_map[(z + 1) * BLOCK_WIDTH + x] = true;
                }
            }

            for (let i = 0; i < 100; i++) {
                this.tryToPlaceBuilding();
            }

            const spike_density = 10 ** (4 * this.rng.double()) - 1;
            for (let i = 0; i < spike_density; i++) {
                this.tryToPlaceSpike();
            }
        }
    }

    tryToPlaceBuilding() {
        let width_x = Math.floor(this.rng.double() * 10) + 10;
        let width_z = Math.floor(this.rng.double() * 10) + 10;
        outer: for (let i = 0; i < 5; i++) {
            // the highest x value in the building
            const max_x = Math.floor(this.rng.double() * (BLOCK_WIDTH - 1));
            const max_z = Math.floor(this.rng.double() * (BLOCK_WIDTH - 1));
            const min_x = max_x - width_x + 1;
            const min_z = max_z - width_z + 1;
            // make sure the building doesn't overlap with any others or with the path
            for (let x of range(min_x - 1, max_x + 1)) {
                for (let z of range(min_z - 1, max_z + 1)) {
                    if (x < 1 || z < 1) {
                        continue outer;
                    }
                    const idx = z * BLOCK_WIDTH + x;
                    if (this.placement_map![idx]) {
                        continue outer;
                    }
                }
            }
            const building = new Building(width_x, width_z, this.rng);
            for (let x of range(min_x, max_x)) {
                for (let z of range(min_z, max_z)) {
                    const idx = z * BLOCK_WIDTH + x;
                    this.placement_map![idx] = true;
                    let offset_x = x - min_x;
                    let offset_z = z - min_z;
                    this.buildings.set(idx, [offset_x, offset_z, building]);
                }
            }
        }
    }

    tryToPlaceSpike() {
        const x = Math.floor(this.rng.double() * (BLOCK_WIDTH - 2)) + 1;
        const z = Math.floor(this.rng.double() * (BLOCK_WIDTH - 2)) + 1;
        for (let cx of range(x - 1, x + 1)) {
            for (let cz of range(z - 1, z + 1)) {
                const idx = cz * BLOCK_WIDTH + cx;
                if (this.placement_map![idx]) {
                    return;
                }
            }
        }
        const height = Math.floor(1 + 30 * this.rng.double());
        const idx = z * BLOCK_WIDTH + x;
        this.placement_map![idx] = true;
        const material = this.rng.double() < 0.5 ? BlockType.SPIKE_1 : BlockType.SPIKE_2;
        this.spikes.set(idx, [material, height]);
    }
}

class Building {
    public readonly height: number;
    private readonly structure: (BlockType | "bob" | null)[];

    // dummy values that are reset by the constructor
    private brick_type_1: boolean = false;
    private brick: BlockType = 0;
    private cracked_brick: BlockType = 0;

    private solid(p_cracked: number) {
        if (this.rng.double() < p_cracked) {
            return this.cracked_brick;
        } else if (this.brick_type_1 && this.rng.double() < 0.01) {
            return BlockType.MOSSY_BRICK_1;
        } else {
            return this.brick;
        }
    }

    constructor(
        public readonly width_x: number,
        public readonly width_z: number,
        private readonly rng: seedrandom.prng,
    ) {
        this.selectBrickType();

        const floor_height = 3 + Math.floor(rng.double() * 3);
        const num_floors = 2 + Math.floor(rng.double() * 4);
        this.height = floor_height * num_floors;
        this.structure = [];

        // determine the placement of 1-3 doors
        const doors: vec2[] = [];
        const num_doors = 1 + Math.floor(rng.double() * 2);
        for (let i = 0; i < num_doors; i++) {
            let door_x;
            let door_z;
            // pick the side to put the door on, and then place it somewhere on that side
            switch (Math.floor(rng.double() * 4)) {
                case 0:
                    door_x = 0;
                    door_z = 1 + Math.floor(rng.double() * (width_z - 2));
                    break;
                case 1:
                    door_x = width_x - 1;
                    door_z = 1 + Math.floor(rng.double() * (width_z - 2));
                    break;
                case 2:
                    door_x = 1 + Math.floor(rng.double() * (width_x - 2));
                    door_z = 0;
                    break;
                case 3:
                    door_x = 1 + Math.floor(rng.double() * (width_x - 2));
                    door_z = width_z - 1;
                    break;
                default:
                    throw "impossible";
            }
            // it's fine if the door position overlaps with existing ones
            doors.push([door_x, door_z]);
        }

        // determine the placement of 0-1 crates per floor
        const crates: ([vec2, boolean] | null)[] = [];
        for (let i = 0; i < num_floors; i++) {
            if (rng.double() < 0.9) {
                let crate_x = 1 + Math.floor(rng.double() * (width_x - 2));
                let crate_z = 1 + Math.floor(rng.double() * (width_z - 2));
                crates.push([[crate_x, crate_z], rng.double() < 0.5]);
            } else {
                crates.push(null);
            }
        }

        // generate the structure of the building
        for (let y = 0; y < this.height; y++) {
            for (let z = 0; z < width_z; z++) {
                for (let x = 0; x < width_x; x++) {
                    let is_x_edge = (x == 0 || x == width_x - 1);
                    let is_z_edge = (z == 0 || z == width_z - 1);
                    let is_edge   = is_x_edge || is_z_edge;
                    let is_corner = is_x_edge && is_z_edge;
                    if (y < 2 && doors.findIndex((door => vec2.equals(door, [x, z]))) != -1) {
                        // doors on the first floor
                        this.structure.push(null);
                    } else if (is_edge) {
                        // walls
                        if (!is_corner && y % floor_height == 1 && rng.double() < 0.5) {
                            // window?
                            this.structure.push(null);
                        } else {
                            this.structure.push(this.solid(0.03));
                        }
                    } else if ((y + 1) % floor_height == 0) {
                        let threshold = y / this.height;
                        // top of the building?
                        if (y == this.height - 1) {
                            this.structure.push(this.solid(0.05));
                        } else if (rng.double() > threshold) {
                            this.structure.push(this.solid(0.3));
                        } else {
                            this.structure.push(null);
                        }
                    } else {
                        const is_floor = y % floor_height == 0;
                        const current_floor = Math.floor(y / floor_height);
                        const current_crate = crates[current_floor];
                        if (is_floor && current_crate !== null && vec2.equals(current_crate[0], [x, z])) {
                            let is_bob = current_crate[1];
                            if (is_bob) {
                                this.structure.push("bob");
                            } else if (current_floor > 0 && rng.double() < 0.3) {
                                this.structure.push(BlockType.GOOD_CRATE);
                            } else {
                                this.structure.push(BlockType.CRATE);
                            }
                        } else {
                            this.structure.push(null);
                        }
                    }
                }
            }
        }
    }

    private selectBrickType() {
        this.brick_type_1 = this.rng.double() < 0.5;
        this.brick = this.brick_type_1 ? BlockType.BRICK_1 : BlockType.BRICK_2;
        this.cracked_brick = this.brick_type_1 ? BlockType.CRACKED_BRICK_1 : BlockType.CRACKED_BRICK_2;
    }

    private getIdx(rel_pos: vec3) {
        const [x, y, z] = rel_pos;
        if (x < 0 || this.width_x <= x) {
            throw "out of bounds";
        }
        if (y < 0 || this.height <= y) {
            throw "out of bounds";
        }
        if (z < 0 || this.width_z <= z) {
            throw "out of bounds";
        }
        const idx
            = y * this.width_x * this.width_z
            + z * this.width_x
            + x;
        if (idx >= this.structure.length) {
            throw "impossible";
        }
        return idx;
    }

    getVoxel(rel_pos: vec3) {
        return this.structure[this.getIdx(rel_pos)];
    }
}

export class Worldgen {
    private readonly regions: Map<String, WorldgenRegion>;
    private readonly seed: string;
    constructor(seed: string) {
        this.seed = seed;
        this.regions = new Map();
    }

    // Return the same string for all chunks in the same region.
    private static getRegionHash(chunk_id: vec3) {
        const region_x = Math.floor(chunk_id[0] / REGION_CHUNKS);
        const region_z = Math.floor(chunk_id[2] / REGION_CHUNKS);
        return `${region_x},${region_z}`;
    }

    private getRegion(chunk_id: vec3) {
        const hash = Worldgen.getRegionHash(chunk_id);
        let region = this.regions.get(hash);
        if (region == undefined) {
            const region_seed = `${this.seed},${hash}`;
            region = new WorldgenRegion(region_seed);
            this.regions.set(hash, region);
        }
        return region;
    }

    genChunk(chunk_id: vec3, chunk: ClientGameChunk): vec3[] {
        const region = this.getRegion(chunk_id);
        if (chunk_id[1] == 0) {
            Worldgen.genSolidChunk(chunk);
            return [];
        } else if (chunk_id[1] == 1) {
            return Worldgen.genSurfaceChunk(region, chunk_id, chunk);
        } else if (chunk_id[1] == 2) {
            return Worldgen.genAirChunk(region, chunk_id, chunk);
        } else {
            throw "impossible";
        }
    }

    private static genSolidChunk(chunk: ClientGameChunk) {
        for (let x = 0; x < CHUNK_BLOCK_COUNT; x++) {
            for (let y = 0; y < CHUNK_BLOCK_COUNT; y++) {
                for (let z = 0; z < CHUNK_BLOCK_COUNT; z++) {
                    let p = (y + 1) / CHUNK_BLOCK_COUNT;
                    if (Math.random() < p * p) {
                        chunk.setDataAt([x, y, z], BlockType.DIRT);
                    }
                }
            }
        }
    }

    private static genSurfaceChunk(
        region: WorldgenRegion,
        chunk_id: vec3,
        chunk: ClientGameChunk,
    ): vec3[] {
        // Create main roads at the borders of regions.

        const region_sub_x = mod(chunk_id[0], REGION_CHUNKS);
        const region_sub_z = mod(chunk_id[2], REGION_CHUNKS);

        const bob_points: vec3[] = [];

        // The last block in a chunk.
        const e = CHUNK_BLOCK_COUNT - 1;

        // Determine the bounds of the block contents and fill roads.
        let noise_bound_x_min = 0;
        let noise_bound_x_max = e;
        if (region_sub_x == 0) {
            chunk.fillRect([0, 0, 0], [1, 0, e], BlockType.ROAD);
            noise_bound_x_min = 2;
        } else if (region_sub_x == REGION_CHUNKS - 1) {
            chunk.fillRect([e, 0, 0], [e-1, 0, e], BlockType.ROAD);
            noise_bound_x_max = e - 2;
        }

        let noise_bound_z_min = 0;
        let noise_bound_z_max = e;
        if (region_sub_z == 0) {
            chunk.fillRect([0, 0, 0], [e, 0, 1], BlockType.ROAD);
            noise_bound_z_min = 2;
        } else if (region_sub_z == REGION_CHUNKS - 1) {
            chunk.fillRect([0, 0, e], [e, 0, e - 1], BlockType.ROAD);
            noise_bound_z_max = e - 2;
        }

        // Place terrain noise appropriately.
        if (region.terrain_noise) {
            for (let x = noise_bound_x_min; x <= noise_bound_x_max; x++) {
                for (let z = noise_bound_z_min; z <= noise_bound_z_max; z++) {
                    // Calculate the aggregate x and z coordinates across the entire region.
                    const region_pos: vec2 = [
                        region_sub_x * CHUNK_BLOCK_COUNT + x,
                        region_sub_z * CHUNK_BLOCK_COUNT + z
                    ];

                    // Normalize this vector to have coordinates between 0 and 1.
                    const region_normalized = vec2.create();
                    vec2.scale(region_normalized, region_pos, 1 / (CHUNK_BLOCK_COUNT * REGION_CHUNKS));

                    // Scale the noise by a factor.
                    vec2.scale(region_pos, region_pos, 1 / 30);

                    let height = region.terrain_noise.simplex2(region_pos[0], region_pos[1]);
                    height = (1 + height) / 2;
                    height = height * region.terrain_height;
                    height = height * zero_at_edges(region_normalized[0]);
                    height = height * zero_at_edges(region_normalized[1]);
                    for (let y = 0; y < height; y++) {
                        chunk.setDataAt([x, y, z], BlockType.GRASS);
                    }
                }
            }
        } else if (region.placement_map) {
            for (let x = noise_bound_x_min; x <= noise_bound_x_max; x++) {
                for (let z = noise_bound_z_min; z <= noise_bound_z_max; z++) {
                    const region_x = region_sub_x * CHUNK_BLOCK_COUNT + x - 2;
                    const region_z = region_sub_z * CHUNK_BLOCK_COUNT + z - 2;
                    let idx;
                    if (region.transpose_placement_map) {
                        idx = region_z * BLOCK_WIDTH + region_x;
                    } else {
                        idx = region_x * BLOCK_WIDTH + region_z;
                    }
                    const elem = region.placement_map![idx];
                    chunk.setDataAt([x, 0, z], elem ? BlockType.ROAD : BlockType.GRASS);

                    const spike_data = region.spikes.get(idx);
                    if (spike_data !== undefined) {
                        const [material, height] = spike_data;
                        for (let y = 0; y < Math.min(height, CHUNK_BLOCK_COUNT - 1); y++) {
                            const is_top = y == height - 1;
                            chunk.setDataAt([x, y + 1, z], is_top ? BlockType.SPIKE_TOP : material);
                        }
                    }

                    const building_data = region.buildings.get(idx);
                    if (building_data !== undefined) {
                        const [building_x, building_z, building] = building_data;
                        for (let y = 0; y < Math.min(building.height, CHUNK_BLOCK_COUNT - 1); y++) {
                            let data = building.getVoxel([building_x, y, building_z]);
                            if (data == "bob") {
                                bob_points.push([x, y + 1, z]);
                            } else if (data !== null) {
                                chunk.setDataAt([x, y + 1, z], data);
                            }
                        }
                    }
                }
            }
        }

        return bob_points;
    }

    private static genAirChunk(
        region: WorldgenRegion,
        chunk_id: vec3,
        chunk: ClientGameChunk,
    ): vec3[] {
        const region_sub_x = mod(chunk_id[0], REGION_CHUNKS);
        const region_sub_z = mod(chunk_id[2], REGION_CHUNKS);

        const bob_points: vec3[] = [];

        if (region.placement_map) {
            for (let x = 0; x < CHUNK_BLOCK_COUNT; x++) {
                const region_x = region_sub_x * CHUNK_BLOCK_COUNT + x - 2;
                if (region_x < 0) continue;
                if (region_x >= BLOCK_WIDTH) continue;
                for (let z = 0; z < CHUNK_BLOCK_COUNT; z++) {
                    const region_z = region_sub_z * CHUNK_BLOCK_COUNT + z - 2;
                    if (region_z < 0) continue;
                    if (region_z >= BLOCK_WIDTH) continue;

                    let idx;
                    if (region.transpose_placement_map) {
                        idx = region_z * BLOCK_WIDTH + region_x;
                    } else {
                        idx = region_x * BLOCK_WIDTH + region_z;
                    }

                    const spike_data = region.spikes.get(idx);
                    if (spike_data !== undefined) {
                        const [material, height] = spike_data;
                        for (let y = CHUNK_BLOCK_COUNT; y < height; y++) {
                            const is_top = y == height - 1;
                            chunk.setDataAt(
                                [x, y - CHUNK_BLOCK_COUNT, z],
                                is_top ? BlockType.SPIKE_TOP : material
                            );
                        }
                    }

                    const building_data = region.buildings.get(idx);
                    if (building_data !== undefined) {
                        const [building_x, building_z, building] = building_data;
                        for (let y = CHUNK_BLOCK_COUNT - 1; y < building.height; y++) {
                            let data = building.getVoxel([building_x, y, building_z]);
                            if (data == "bob") {
                                bob_points.push([x, y - CHUNK_BLOCK_COUNT + 1, z]);
                            } else if (data !== null) {
                                chunk.setDataAt([x, y - CHUNK_BLOCK_COUNT + 1, z], data);
                            }
                        }
                    }
                }
            }
        }

        return bob_points;
    }
}