import {SimpleMeshRenderer, SimpleMeshTriangleVert} from "./simpleMeshRenderer";
import {mat4, vec3} from "gl-matrix";
import {FaceDefinition, FACES_LIST} from "../../voxel-data/faces";
import {GlCtx} from "../../utils/typeSafety/aliases";

export class SimpleCubicMeshConstructor {
    private readonly vertices: SimpleMeshTriangleVert[] = [];
    private readonly transform_matrix = mat4.create();

    setTransform(pos: vec3, scale: vec3 = vec3.create(), handle: vec3 = vec3.create()) {
        const {transform_matrix: mat} = this;
        mat4.identity(mat);
        {
            const work_vec = vec3.clone(scale);
            vec3.multiply(work_vec, work_vec, handle);
            vec3.sub(work_vec, pos, work_vec);
            mat4.translate(mat, mat, work_vec);
        }
        mat4.scale(mat, mat, scale);
        return this;
    }

    addFace(face: FaceDefinition) {
        face.axis.appendQuadMeshData(this.vertices, this.transform_matrix, face.axis_sign);
        return this;
    }

    addCube() {
        for (const face of FACES_LIST) {
            this.addFace(face);
        }
        return this;
    }

    buildMesh(gl: GlCtx, buffer: WebGLBuffer): SimpleMeshRenderer {
        return new SimpleMeshRenderer(gl, buffer, this.vertices);
    }
}