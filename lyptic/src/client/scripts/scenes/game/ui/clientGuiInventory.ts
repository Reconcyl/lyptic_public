import {HTMLElementBuilder, mapGenerator} from "../../../helpers/utils";
import {ClientGuiItemStack} from "./clientGuiItemStack";
import {SharedItemStack} from "../../../../../shared/gameplay/entities/sharedPlayerController";

type State = {
    id: "idle"
} | {
    id: "moving",
    target_stack_idx: number,
    target_stack_gui: ClientGuiItemStack
};

export class ClientGuiInventory {
    public readonly dom_root: HTMLElement;
    private state: State = { id: "idle" };

    constructor(public readonly item_stacks: ReadonlyArray<ClientGuiItemStack>, fetch_stack: (idx: number) => SharedItemStack | null, handle_action: (from_idx: number, to_idx: number,) => void) {
        // Bind events
        let idx_counter = 0;
        for (const item_stack_gui of item_stacks) {
            const item_idx = idx_counter;
            item_stack_gui.dom_root.addEventListener("click", () => {
                const item_stack_data = fetch_stack(item_idx);

                if (this.state.id == "idle") {
                    if (item_stack_data != null) {
                        item_stack_gui.dom_root.classList.add("highlighted");
                        this.state = {
                            id: "moving",
                            target_stack_idx: item_idx,
                            target_stack_gui: item_stack_gui
                        };
                    }
                } else {
                    if (item_idx != this.state.target_stack_idx) {
                        handle_action(this.state.target_stack_idx, item_idx);
                    }
                    this.resetState();
                }
            });
            idx_counter++;
        }

        // Construct DOM
        this.dom_root = new HTMLElementBuilder("div", "inventory-root")
            .addChild(new HTMLElementBuilder("h1", "title")
                .addText("Inventory")
                .element)
            .addChild(new HTMLElementBuilder("div", "contents")
                .addChildren(mapGenerator(this.item_stacks, stack => stack.dom_root)))
            .element;
    }

    resetState() {
        if (this.state.id != "moving") return;
        this.state.target_stack_gui.dom_root.classList.remove("highlighted");
        this.state = {id: "idle"};
    }
}