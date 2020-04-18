export interface IRenderBucket<TContext, TTarget> {
    begin(context: TContext): {
        render(context: TContext, target: TTarget): void,
        finish(context: TContext): void
    }
}

/**
 * @desc Provides a simple system for rendering entities in batches (what this utility calls batches).
 * Batches are determined by a "rendering bucket" which defines the startup, render, and cleanup logic for rendering a
 * group of entities.
 * A bucket could be used for each type of entity or a bucket could be shared if multiple entities have shared WebGl
 * state that doesn't need to be modified.
 * NOTE: Entity buckets and the entities they contain are rendered in an arbitrary order.
 */
export class EntityBatchesRenderer<TContext, TTargetBase> {
    private readonly entity_buckets = new Map<IRenderBucket<TContext, TTargetBase>, Set<TTargetBase>>();

    /**
     * @desc Registers the entity in a bucket.
     */
    registerEntity<TTarget extends TTargetBase>(bucket: IRenderBucket<TContext, TTarget>, target: TTarget) {
        const {entity_buckets} = this;
        let entities: Set<any> | undefined = entity_buckets.get(bucket);
        if (entities == null) {
            entities = new Set();
            entity_buckets.set(bucket, entities);
        }
        entities.add(target);
    }

    /**
     * @desc Clears all buckets, effectively unregistering all entities.
     */
    clearAllBuckets() {
        this.entity_buckets.clear();
    }

    /**
     * @desc Unregisters the entity from a bucket.
     * NOTE: The specified bucket must be the same as the bucket the entity was registered in.
     * @throws An error if the bucket the entity reported was incorrect or the entity wasn't registered in the first place.
     */
    unregisterEntity<TTarget extends TTargetBase>(bucket: IRenderBucket<TContext, TTarget>, entity: TTarget) {
        const entities = this.entity_buckets.get(bucket);
        console.assert(entities != null);
        entities!.delete(entity);
        if (entities!.size == 0)
            this.entity_buckets.delete(bucket);
    }

    /**
     * @desc Only clears a specific bucket.
     */
    clearBucket(bucket: IRenderBucket<TContext, any>) {
        this.entity_buckets.delete(bucket);
    }

    /**
     * @desc Returns the list of entities in a bucket.
     * While you can modify this array, please don't. Use registerEntity() and unregisterEntity() instead.
     */
    getBucketEntities<TTarget extends TTargetBase>(bucket: IRenderBucket<TContext, TTarget>): TTarget[] {
        const entities = this.entity_buckets.get(bucket);
        if (entities == null) return [];
        return entities as unknown as TTarget[];
    }

    /**
     * @desc Iterates through all entities in the container.
     */
    *iterateEntities(): Iterable<TTargetBase> {
        for (const bucket of this.entity_buckets.values()) {
            for (const entity of bucket.values()) {
                yield entity;
            }
        }
    }

    /**
     * @desc Renders all entities in batches, passing the buckets in your global context data.
     * @param context_data: The user-defined context data to be passed.
     */
    render(context_data: TContext) {
        for (const [bucket, entities] of this.entity_buckets.entries()) {
            const context = bucket.begin(context_data);
            for (const entity of entities.values()) {
                context.render(context_data, entity);
            }
            context.finish(context_data);
        }
    }
}