import {ClientEngine} from "../../../engine/clientEngine";
import {ClientGameWorld} from "../../clientGameWorld";
import {FpsSpatialController} from "../../../../../../../voxel-engine/rendering-core/fpsSpatialController";
import {mat4, vec3} from "gl-matrix";
import {ClientBatchRenderingCtx} from "./batchRendering";
import {SharedHpController} from "../../../../../../shared/gameplay/entities/sharedHpController";
import {ItemTypeDefinition, ItemTypeSwordBehaviorDefinition} from "../../../../../../shared/gameplay/data/itemTypes";

export type ClientEntityTickingContext = {
    engine: ClientEngine,
    world: ClientGameWorld
};

export interface IClientEntity {
    generateTransform(ctx: ClientBatchRenderingCtx): mat4;
    onTick(ctx: ClientEntityTickingContext): void;
    isColliding(other: vec3): boolean;
    hitByPlayer(ctx: ClientEntityTickingContext, type: ItemTypeSwordBehaviorDefinition, knock_dir: vec3): void;
}