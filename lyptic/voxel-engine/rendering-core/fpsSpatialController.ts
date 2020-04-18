import {mat4, vec2, vec3} from "gl-matrix";

export class FpsSpatialController {
    constructor(public origin: vec3, public pitch: number, public yaw: number) {}

    getDirectionHorizontal(): vec2 {
        const {pitch} = this;
        return [
            Math.cos(pitch),
            -Math.sin(pitch)
        ];
    }

    getDirectionHorizontalV3(vertical: number): vec3 {
        const {pitch} = this;
        return [
            Math.cos(pitch),
            vertical,
            -Math.sin(pitch)
        ];
    }

    getDirection(): vec3 {
        const {yaw} = this;
        const horizontal_dir = this.getDirectionHorizontal();
        const horiz_component_magnitude = Math.cos(yaw);
        return [
            horizontal_dir[0] * horiz_component_magnitude,
            Math.sin(yaw),
            horizontal_dir[1] * horiz_component_magnitude
        ];
    }

    getPitchAngleTo(other: vec3) {
        return Math.atan2(other[0] - this.origin[0], other[2] - this.origin[2]);
    }

    generateTransform(transform: mat4 = mat4.create()): mat4 {
        mat4.translate(transform, transform, this.origin);
        mat4.rotateY(transform, transform, this.pitch - Math.PI / 2);
        mat4.rotateX(transform, transform, this.yaw);
        return transform;
    }
}