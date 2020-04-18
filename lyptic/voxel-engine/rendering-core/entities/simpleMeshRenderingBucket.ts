import {IRenderBucket} from "./entityBatchesRenderer";
import {GlCtx} from "../../utils/typeSafety/aliases";
import {mat4} from "gl-matrix";
import {SimpleMeshRenderer} from "./simpleMeshRenderer";
import {CleanupPool} from "../../utils/memory/cleanupPool";
import {SimpleMeshRenderingShaderInfo} from "../shaders/defaultShaders";

/**
 * @desc A rendering bucket for use with the EntityBatchesRenderer that wraps a SimpleMeshRenderer for easy batch style
 * usage. This abstraction provides:
 * - Proper program state
 * - Attribute setup
 * - View matrix setup (user defined at an entity basis)
 * See SimpleMeshRenderer.render(...) for a list of all gl things you should/must provide.
 */
export class SimpleMeshRenderingBucket<TContext, TTarget> implements IRenderBucket<TContext, TTarget> {
    constructor(private readonly config: {
        getGl: (context: TContext) => GlCtx,
        getEntityViewMatrix: (context: TContext, entity: TTarget) => mat4,
        mesh: SimpleMeshRenderer, rendering_program: SimpleMeshRenderingShaderInfo,
        texture_unit: number,
        bucket_logic_hook?: IRenderBucket<TContext, TTarget>
    }) {}

    begin(context: TContext) {
        const {getGl, getEntityViewMatrix, mesh, rendering_program, texture_unit, bucket_logic_hook} = this.config;
        const cleanup_pool = new CleanupPool();
        const gl = getGl(context);
        gl.useProgram(rendering_program.program);
        cleanup_pool.enableGlAttrib(gl, rendering_program.attrib_pos);
        cleanup_pool.enableGlAttrib(gl, rendering_program.attrib_uv);
        mesh.bindMesh(gl, rendering_program);
        gl.uniform1i(rendering_program.uniform_sampler, texture_unit);

        const hooked_bl = bucket_logic_hook != null ? bucket_logic_hook.begin(context) : null;

        return {
            render(context: TContext, entity: TTarget) {
                gl.uniformMatrix4fv(rendering_program.uniform_view_mat, false, getEntityViewMatrix(context, entity));
                mesh.render(gl);
                hooked_bl?.render(context, entity);
            },
            finish(context: TContext) {
                cleanup_pool.cleanup();
                hooked_bl?.finish(context);
            }
        };
    }

}