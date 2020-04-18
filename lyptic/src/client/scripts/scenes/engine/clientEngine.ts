import {GlCtx} from "../../../../../voxel-engine/utils/typeSafety/aliases";
import {InputActionBindableKey, InputActionsController} from "./inputActionsController";
import {ClientGameResources} from "./resources";

// Definitions
export type ClientSceneFactory = (engine: ClientEngine) => BaseClientScene;

export abstract class BaseClientScene {
    onDetached(engine: ClientEngine) {}

    onKeyDown(engine: ClientEngine, e: KeyboardEvent) {}
    onKeyUp(engine: ClientEngine, e: KeyboardEvent) {}
    onMouseDown(engine: ClientEngine, e: MouseEvent) {}
    onMouseUp(engine: ClientEngine, e: MouseEvent) {}
    onMouseMove(engine: ClientEngine, e: MouseEvent) {}

    onTick(engine: ClientEngine) {}
    onPointerLockLost(engine: ClientEngine) {}
    onResized(engine: ClientEngine) {}
}

// Class
export class ClientEngine {
    // Inputs
    public input_service = new InputActionsController({
        move_forward: new InputActionBindableKey("KeyW"),
        move_backward: new InputActionBindableKey("KeyS"),
        move_strafe_left: new InputActionBindableKey("KeyA"),
        move_strafe_right: new InputActionBindableKey("KeyD"),
        move_jump: new InputActionBindableKey("Space"),
        interact: new InputActionBindableKey(0),

        inv_hot_0: new InputActionBindableKey("Digit1"),
        inv_hot_1: new InputActionBindableKey("Digit2"),
        inv_hot_2: new InputActionBindableKey("Digit3"),
        inv_hot_3: new InputActionBindableKey("Digit4"),
        inv_hot_4: new InputActionBindableKey("Digit5"),
        inv_hot_5: new InputActionBindableKey("Digit6"),
        inv_hot_6: new InputActionBindableKey("Digit7"),
        inv_hot_7: new InputActionBindableKey("Digit8"),
        inv_hot_8: new InputActionBindableKey("Digit9"),

        inv_toggle_view: new InputActionBindableKey("KeyE"),
        pause_menu: new InputActionBindableKey("Escape")
    });
    private input_keys_down = new Set<string>();
    private input_mouse_buttons_down = new Set<number>();

    // Scenes
    private active_scene: BaseClientScene;
    private next_scene: ClientSceneFactory | null = null;

    // Constructor
    constructor(public readonly canvas: HTMLCanvasElement, public readonly gl: GlCtx,
            public readonly resources: ClientGameResources, initial_scene: ClientSceneFactory) {
        const {body} = document;

        // Bind events
        body.addEventListener("keydown", this.handleKeydown.bind(this));
        body.addEventListener("keyup", this.handleKeyup.bind(this));
        body.addEventListener("mousedown", this.handleMouseDown.bind(this));
        body.addEventListener("mouseup", this.handleMouseUp.bind(this));
        body.addEventListener("mousemove", this.handleMouseMove.bind(this));
        body.addEventListener("contextmenu", e => e.preventDefault());  // To avoid right click menu.
        document.addEventListener("pointerlockchange", this.handlePointerLockLost.bind(this));
        window.addEventListener("resize", () => this.handleResize(true));
        this.handleResize(false);

        // Start engine
        body.append(canvas);
        this.active_scene = initial_scene(this);
        this.tick();
        console.log("First frame ticked!");
    }

    // Handlers
    private handleKeydown(e: KeyboardEvent) {
        this.input_keys_down.add(e.code);
        this.active_scene.onKeyDown(this, e);
    }

    private handleKeyup(e: KeyboardEvent) {
        this.input_keys_down.delete(e.code);
        this.active_scene.onKeyUp(this, e);
    }

    private handleMouseDown(e: MouseEvent) {
        this.input_mouse_buttons_down.add(e.button);
        this.active_scene.onMouseDown(this, e);
    }

    private handleMouseUp(e: MouseEvent) {
        this.input_mouse_buttons_down.delete(e.button);
        this.active_scene.onMouseUp(this, e);
    }

    private handleMouseMove(e: MouseEvent) {
        this.active_scene.onMouseMove(this, e);
    }

    private handlePointerLockLost() {
        if (document.pointerLockElement !== document.body)
            this.active_scene.onPointerLockLost(this);
    }

    private handleResize(dynamic: boolean) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        if (dynamic) this.active_scene.onResized(this);
    }

    private tick() {
        requestAnimationFrame(this.tick.bind(this));
        if (this.next_scene != null) {
            this.active_scene.onDetached(this);
            this.active_scene = this.next_scene(this);
            this.next_scene = null;
        }
        this.input_service.tick(this.input_keys_down, this.input_mouse_buttons_down);
        this.active_scene.onTick(this);
    }

    swapScene(new_scene: ClientSceneFactory) {
        this.next_scene = new_scene;
    }
}
