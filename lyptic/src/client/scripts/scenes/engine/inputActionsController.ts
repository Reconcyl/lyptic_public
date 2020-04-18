// TODO: Move to voxel-engine
import {RecordV} from "../../../../../voxel-engine/utils/typeSafety/aliases";

export class InputActionsController<TActions extends RecordV<AbstractInputAction>> {
    constructor(public readonly actions: TActions) {}

    tick(input_keys: Set<string>, input_mouse_buttons: Set<number>) {
        for (const key in this.actions) {
            if (!this.actions.hasOwnProperty(key)) continue;
            const action = this.actions[key];
            action.last_frame_pressed = action.is_pressed;
            action.is_pressed = action.isActive(input_keys, input_mouse_buttons);
        }
    }

    isActionPressed(name: keyof TActions) {
        return this.actions[name].is_pressed;
    }

    wasActionJustPressed(name: keyof TActions) {
        return this.actions[name].was_just_pressed;
    }

    wasActionJustReleased(name: keyof TActions) {
        return this.actions[name].was_just_released;
    }
}

export abstract class AbstractInputAction {
    public last_frame_pressed = false;
    public is_pressed = false;

    get was_just_pressed() {
        return this.is_pressed && !this.last_frame_pressed;
    }

    get was_just_released() {
        return !this.is_pressed && this.last_frame_pressed;
    }

    abstract isActive(keys: Set<string>, mouse_buttons: Set<number>): boolean;
}

export class InputActionBindableKey extends AbstractInputAction {
    constructor(public bound_input: string | number) {
        super();
    }

    isActive(keys: Set<string>, mouse_buttons: Set<number>): boolean {
        return typeof this.bound_input == "string" ? keys.has(this.bound_input)
            : mouse_buttons.has(this.bound_input);
    }

}
