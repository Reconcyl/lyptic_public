import {AsyncMultiResourceLoader} from "../../../voxel-engine/utils/loading/asyncMultiResourceLoader";
import {makeGlTexture, makeTextureLoader} from "../../../voxel-engine/utils/loading/textureLoading";
import {
    CoreEntityShaderLoader,
    CoreVoxelShaderLoader
} from "../../../voxel-engine/rendering-core/shaders/defaultShaders";
import {ClientEngine} from "./scenes/engine/clientEngine";
import {ClientGameResources, ClientGameTextureUnits} from "./scenes/engine/resources";
import {GlCtx} from "../../../voxel-engine/utils/typeSafety/aliases";
import {SimpleCubicMeshConstructor} from "../../../voxel-engine/rendering-core/entities/simpleCubicMeshConstructor";
import {assertThere} from "../../../voxel-engine/utils/typeSafety/optionals";
import {ClientMenuRoot} from "./scenes/menu/clientMenuRoot";

import ASSET_VOXEL_TEXTURE_URI from "../res/voxel_textures.png";
import ASSET_SAD_DUDE_URI from "../res/sad_dude.png";
import ASSET_VOXEL_BREAK_INDICATOR_URI from "../res/voxel_break_indicator.png";

const status_display = document.createElement("p");
status_display.innerText = "Loading...";
status_display.className = "loading-status";
document.body.append(status_display);

async function initializeEngine(): Promise<{ canvas: HTMLCanvasElement, gl: GlCtx, resources: ClientGameResources }> {
    // Create WebGl context
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (gl == null) throw "Failed to get WebGl context";

    // Load assets
    const loader = new AsyncMultiResourceLoader(9, true, {
        voxel_textures: makeTextureLoader(ASSET_VOXEL_TEXTURE_URI),
        sad_dude: makeTextureLoader(ASSET_SAD_DUDE_URI),
        voxel_break_indicator: makeTextureLoader(ASSET_VOXEL_BREAK_INDICATOR_URI)
    });
    const assets = await loader.promise;
    console.log("Got assets.");

    // Load shaders
    const shaders = {
        voxel_shader: CoreVoxelShaderLoader.loadDefaultShader(gl).getOrThrow(),
        mesh_shader: CoreEntityShaderLoader.loadDefaultShader(gl).getOrThrow()
    };

    // Create meshes
    const meshes = {
        simple_mesh: new SimpleCubicMeshConstructor()
            // Legs
            .setTransform([0, 0, 0], [0.5, 1, 0.4], [0.5, 0, 1.1]).addCube() // Left
            .setTransform([0, 0, 0], [0.5, 1, 0.4], [0.5, 0, -0.1]).addCube() // Right

            // Torso & Head
            .setTransform([0, 1, 0], [0.5, 1, 1], [0.5, 0, 0.5]).addCube()
            .setTransform([0, 2, 0], [0.6, 0.6, 0.6], [0.5, 0, 0.5]).addCube()

            // Arms
            .setTransform([0, 2, -0.5], [0.4, 1, 0.4], [0.5, 1, 1]).addCube()  // Left
            .setTransform([0, 2,  0.5], [0.4, 1, 0.4], [0.5, 1, 0]).addCube()  // Left

            .buildMesh(gl, assertThere(gl.createBuffer())),
        break_indicator: new SimpleCubicMeshConstructor()
            .addCube()
            .buildMesh(gl, assertThere(gl.createBuffer()))
    };

    // Setup voxel rendering shader
    gl.useProgram(shaders.voxel_shader.program);
    makeGlTexture(gl, ClientGameTextureUnits.voxel_textures, {
        provider: assets.voxel_textures,
        type: "UNSIGNED_BYTE",
        format: "RGB"
    }, {
        TEXTURE_MIN_FILTER: "NEAREST",
        TEXTURE_MAG_FILTER: "NEAREST"
    });
    gl.uniform1i(shaders.voxel_shader.uniform_textures_sampler, ClientGameTextureUnits.voxel_textures);
    gl.uniform2f(shaders.voxel_shader.uniform_textures_count, 4, 4);

    // Load other texture
    makeGlTexture(gl, ClientGameTextureUnits.sad_dude, {
        provider: assets.sad_dude,
        type: "UNSIGNED_BYTE",
        format: "RGB"
    }, {
        TEXTURE_MIN_FILTER: "NEAREST",
        TEXTURE_MAG_FILTER: "NEAREST"
    });

    makeGlTexture(gl, ClientGameTextureUnits.voxel_break_indicator, {
        provider: assets.voxel_break_indicator,
        type: "UNSIGNED_BYTE",
        format: "RGBA"
    }, {
        TEXTURE_MIN_FILTER: "NEAREST",
        TEXTURE_MAG_FILTER: "NEAREST"
    });

    // Finish
    return {
        canvas, gl,
        resources: {
            shader_voxel: shaders.voxel_shader,
            shader_simple_mesh: shaders.mesh_shader,
            mesh_base: meshes.simple_mesh,
            mesh_break_indicator: meshes.break_indicator
        }
    };
}

console.log("Starting engine...");
initializeEngine()
    .then(({ canvas, gl, resources }) => {
        console.log("Root loading...");
        status_display.remove();
        new ClientEngine(canvas, gl, resources, root => new ClientMenuRoot(root));
    })
    .catch(e => {
        console.error("Failed to initialize engine", e);
        status_display.innerText = e;
    });