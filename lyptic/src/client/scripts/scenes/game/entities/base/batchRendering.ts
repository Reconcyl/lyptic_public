import {GlCtx} from "../../../../../../../voxel-engine/utils/typeSafety/aliases";
import {mat4} from "gl-matrix";
import {ClientEngine} from "../../../engine/clientEngine";
import {SimpleMeshRenderingBucket} from "../../../../../../../voxel-engine/rendering-core/entities/simpleMeshRenderingBucket";
import {ClientEntityBob} from "../types/clientEntityBob";
import {ClientGameTextureUnits} from "../../../engine/resources";

export type ClientBatchRenderingCtx = {
    gl: GlCtx,
    view_matrix: mat4
};

export type ClientBatchRenderingBuckets = {
    ent_bob: SimpleMeshRenderingBucket<ClientBatchRenderingCtx, ClientEntityBob>
}

export function makeClientBatchRenderingBuckets(engine: ClientEngine): ClientBatchRenderingBuckets {
    return {
        ent_bob: new SimpleMeshRenderingBucket({
            getGl(ctx) {
                return ctx.gl;
            },
            getEntityViewMatrix(ctx, ent) {
                const mat = ent.generateTransform(ctx);
                mat4.multiply(mat, ctx.view_matrix, mat);
                return mat;
            },
            rendering_program: engine.resources.shader_simple_mesh,
            texture_unit: ClientGameTextureUnits.sad_dude,
            mesh: engine.resources.mesh_base
        })
    }
}
