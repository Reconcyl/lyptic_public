import {GlCtx} from "../typeSafety/aliases";

export class CleanupPool {
    private readonly tasks: (() => void)[] = [];

    registerTask(task: () => void) {
        this.tasks.push(task);
    }

    registerGlShader(gl: GlCtx, shader: WebGLShader) {
        this.registerTask(() => gl.deleteShader(shader));
    }

    registerGlProgram(gl: GlCtx, program: WebGLProgram) {
        this.registerTask(() => gl.deleteProgram(program));
    }

    enableGlAttrib(gl: GlCtx, attrib: number) {
        gl.enableVertexAttribArray(attrib);
        this.registerTask(() => gl.disableVertexAttribArray(attrib));
    }

    setGlFlag(gl: GlCtx, flag: GLenum, state: boolean) {
        if (gl.isEnabled(flag) == state) return;
        gl[state ? "enable" : "disable"](flag);
        this.registerTask(() => gl[state ? "disable" : "enable"](flag));
    }

    cleanup() {
        for (const task of this.tasks) {
            task();
        }
    }

    static runScope(cb: (pool: CleanupPool) => void) {
        const pool = new CleanupPool();
        cb(pool);
        pool.cleanup();
    }
}