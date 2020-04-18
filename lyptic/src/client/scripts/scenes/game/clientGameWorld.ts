import {VoxelWorldData} from "../../../../../voxel-engine/voxel-data/voxelWorldData";
import {VoxelChunkWorldRendering} from "../../../../../voxel-engine/rendering-core/voxels/voxelWorldChunksRenderer";
import {mat4, vec3} from "gl-matrix";
import {BaseClientScene, ClientEngine} from "../engine/clientEngine";
import {GlCtx} from "../../../../../voxel-engine/utils/typeSafety/aliases";
import {ClientGameChunk} from "./clientGameChunk";
import {CleanupPool} from "../../../../../voxel-engine/utils/memory/cleanupPool";
import {EntityBatchesRenderer} from "../../../../../voxel-engine/rendering-core/entities/entityBatchesRenderer";
import {
    ClientBatchRenderingBuckets,
    ClientBatchRenderingCtx,
    makeClientBatchRenderingBuckets
} from "./entities/base/batchRendering";
import {ClientEntityBob} from "./entities/types/clientEntityBob";
import {Worldgen} from "../../../../shared/world_generation/worldgen";
import {ClientGameLocalPlayer} from "./clientGameLocalPlayer";
import {BlockType} from "../../../../shared/gameplay/data/blockIds";
import {ClientGameTextureUnits} from "../engine/resources";
import {ClientEntityTickingContext, IClientEntity} from "./entities/base/clientEntityInterfaces";
import {FpsSpatialController} from "../../../../../voxel-engine/rendering-core/fpsSpatialController";
import {VoxelChunkPointer} from "../../../../../voxel-engine/voxel-data/voxelChunkData";

export class ClientGameWorld extends BaseClientScene {
    // Player
    readonly local_player: ClientGameLocalPlayer;

    // Voxel
    readonly world_data = new VoxelWorldData<ClientGameChunk, BlockType>();
    private readonly chunks_renderer: VoxelChunkWorldRendering;
    private readonly world_gen: Worldgen;

    // World
    public readonly entities_renderer = new EntityBatchesRenderer<ClientBatchRenderingCtx, IClientEntity>();
    public readonly entity_rendering_buckets: ClientBatchRenderingBuckets;

    // Lifecycle
    constructor(engine: ClientEngine, seed: string) {
        super();
        const {gl} = engine;

        // Create player
        this.local_player = new ClientGameLocalPlayer(engine, [0, 20, 0]);
        document.body.append(this.local_player.gui_controller.dom_root);

        // Spawn entities
        this.entity_rendering_buckets = makeClientBatchRenderingBuckets(engine);
        // Setup voxels
        this.chunks_renderer = new VoxelChunkWorldRendering(this.local_player.fps_camera);

        this.world_gen = new Worldgen(seed);
        // Generate world
        for (let x = -5; x <= 5; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = -5; z <= 5; z++) {
                    this.addChunk(engine.gl, [x, y, z]);
                }
            }
        }
        this.updateProjection(engine);

        // Setup GL
        gl.clearColor(30 / 255, 30 / 255, 50 / 255, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }

    onDetached(engine: ClientEngine) {
        const {gl} = engine;
        for (const chunk of this.world_data.iterChunks()) {
            chunk.voxel_chunk_renderer.free(gl);
        }
        this.local_player.gui_controller.dom_root.remove();
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
    }

    // Event handlers
    onTick(engine: ClientEngine) {
        const {gl, resources} = engine;

        const player_chunk = VoxelWorldData.worldSpaceToWorldChunkSpace(this.local_player.fps_camera.position);
        const chunks_to_render: Set<string> = new Set();
        for (let x = -5; x <= 5; x++) {
            for (let z = -5; z <= 5; z++) {
                if (x * x + z * z <= 5.3 * 5.3) {
                    for (let y = 0; y < 3; y++) {
                        let chunk: vec3 = [x + player_chunk[0], y, z + player_chunk[2]];
                        this.addChunk(engine.gl, chunk);
                        chunks_to_render.add(VoxelWorldData.encodeChunkPosition(chunk));
                    }
                }
            }
        }

        // Tick entities
        {
            const ticking_context: ClientEntityTickingContext = { engine, world: this };
            this.local_player.onUpdate(ticking_context);
            for (const bob of this.entities_renderer.getBucketEntities(this.entity_rendering_buckets.ent_bob)) {
                bob.onTick(ticking_context);
            }
        }

        // Render world
        {
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

            // Generate view matrix
            const view_matrix = this.local_player.fps_camera.generateViewMatrix();

            // Render voxels
            CleanupPool.runScope(pool => {
                const shader = resources.shader_voxel;
                gl.useProgram(shader.program);
                pool.enableGlAttrib(gl, shader.attrib_vertex_data);
                gl.uniformMatrix4fv(shader.uniform_view_mat, false, view_matrix);
                this.chunks_renderer.render(
                    gl, shader, this.world_data.iterSpecificChunks(chunks_to_render));
            });

            // Render entities
            this.entities_renderer.render({ gl, view_matrix });

            // Breaking indicator
            const break_status = this.local_player.break_status;
            if (break_status != null) {
                CleanupPool.runScope(pool => {
                    const shader = resources.shader_simple_mesh;
                    const mesh = engine.resources.mesh_break_indicator;

                    // Setup GL flags
                    gl.useProgram(shader.program);
                    pool.enableGlAttrib(gl, shader.attrib_pos);
                    pool.enableGlAttrib(gl, shader.attrib_uv);
                    pool.setGlFlag(gl, gl.DEPTH_TEST, false);

                    // Create transform
                    const transform = mat4.create();
                    mat4.translate(transform, transform, break_status.target.getPosWs());

                    const scale = 1 - (Date.now() - break_status.started_break) / (break_status.breaks_at - break_status.started_break);
                    const centering_translation = (1 - scale) / 2;
                    mat4.translate(transform, transform, [centering_translation, centering_translation, centering_translation]);
                    mat4.scale(transform, transform, [scale, scale, scale]);

                    // Upload transform to shader
                    mat4.multiply(transform, view_matrix, transform);
                    gl.uniformMatrix4fv(shader.uniform_view_mat, false, transform);
                    gl.uniform1i(shader.uniform_sampler, ClientGameTextureUnits.voxel_break_indicator);

                    // Render
                    mesh.bindMesh(gl, shader);
                    mesh.render(gl);
                });
            }
        }
    }

    onMouseDown(engine: ClientEngine, e: MouseEvent) {
        const desired_state = this.local_player.getDesiredPointerState();
        if (desired_state !== ClientGameLocalPlayer.getPointerLockState())
            ClientGameLocalPlayer.setPointerLockState(desired_state);
    }

    onMouseMove(engine: ClientEngine, e: MouseEvent) {
        this.local_player.onMouseMove(e);
    }

    onPointerLockLost(engine: ClientEngine) {
        this.local_player.onPointerLockLost();
    }

    onResized(engine: ClientEngine) {
        const {canvas} = engine;
        this.local_player.fps_camera.proj_state.aspect = canvas.width / canvas.height;
        this.updateProjection(engine);
    }

    // Utils
    private addChunk(gl: GlCtx, pos: vec3) {
        if (this.world_data.hasChunk(pos)) {
            return;
        }
        const chunk = new ClientGameChunk(gl, pos);
        const bob_points = this.world_gen.genChunk(pos, chunk);
        for (let bob of bob_points) {
            vec3.add(bob, bob, [0, 1.6, 0]);
            this.spawnBob(chunk.voxel_chunk_data.chunkRelativePosToWs(bob));
        }
        chunk.registerGeneration(gl);
        this.world_data.putChunk(pos, chunk);
        return chunk;
    }

    private updateProjection(engine: ClientEngine) {
        const {gl, resources} = engine;
        const proj_mat = this.local_player.fps_camera.generateProjectionMatrix();

        gl.useProgram(resources.shader_voxel.program);
        gl.uniformMatrix4fv(resources.shader_voxel.uniform_projection_mat, false, proj_mat);

        gl.useProgram(resources.shader_simple_mesh.program);
        gl.uniformMatrix4fv(resources.shader_simple_mesh.uniform_projection_mat, false, proj_mat);
    }

    spawnBob(pos: vec3) {
        this.entities_renderer.registerEntity(this.entity_rendering_buckets.ent_bob, new ClientEntityBob(
            new FpsSpatialController(pos, 0, 0)
        ));
    }

    isVoxelSolid(pointer: VoxelChunkPointer<ClientGameChunk, BlockType> | null): boolean {
        return pointer?.hasVoxel() || false;
    }
}