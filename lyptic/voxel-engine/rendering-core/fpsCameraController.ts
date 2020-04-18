import {mat4, vec3} from "gl-matrix";
import {FpsSpatialController} from "./fpsSpatialController";

export type FpsCameraProjState = {
    clipping_near: number,
    clipping_far: number,
    aspect: number,
    fov_rad: number
};

export class FpsCameraController {
    constructor(public proj_state: FpsCameraProjState, public view_state: FpsSpatialController) {}

    generateProjectionMatrix(): mat4 {
        const {proj_state} = this;
        const write_to = mat4.create();
        mat4.perspective(write_to, proj_state.fov_rad, proj_state.aspect, proj_state.clipping_near, proj_state.clipping_far);
        return write_to;
    }

    generateViewMatrix(): mat4 {
        const write_to = mat4.create();
        this.view_state.generateTransform(write_to);
        mat4.invert(write_to, write_to);
        return write_to;
    }

    get position(): vec3 {
        return this.view_state.origin;
    }
}