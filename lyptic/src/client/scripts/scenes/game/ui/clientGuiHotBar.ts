import {HTMLElementBuilder, mapGenerator} from "../../../helpers/utils";
import {ClientGuiItemStack} from "./clientGuiItemStack";

export class ClientGuiHotBar {
    public readonly dom_root: HTMLElement;
    private readonly dom_selection_indicator: HTMLElement;
    private readonly dom_hp: HTMLElement;

    constructor(initial_hp: number, initial_slot: number, public readonly item_stacks: ReadonlyArray<ClientGuiItemStack>) {
        // Selection
        this.dom_selection_indicator = new HTMLElementBuilder("div", "indicator").element;
        this.dom_selection_indicator.style.setProperty("--selected-slot", initial_slot.toString());

        // HP
        this.dom_hp = new HTMLElementBuilder("div", "hp-display")
            .addChild(new HTMLElementBuilder("div", "latent"))
            .addChild(new HTMLElementBuilder("div", "health"))
            .element;

        this.dom_hp.style.setProperty("--hp-percent", `${initial_hp}%`);

        // Rot
        this.dom_root = new HTMLElementBuilder("div", "hot-bar")
            .addChild(new HTMLElementBuilder("div", "contents")
                .addChildren(mapGenerator(this.item_stacks, stack => stack.dom_root))
                .addChild(this.dom_selection_indicator)
                .addChild(this.dom_hp))
            .element;
    }

    private static updateStackSelectionStatus(stack: ClientGuiItemStack, is_selected: boolean) {
        stack.dom_root.classList[is_selected ? "add" : "remove"]("selected");
    }

    selectedSlotChanged(from: number, to: number) {
        ClientGuiHotBar.updateStackSelectionStatus(this.item_stacks[from], false);
        ClientGuiHotBar.updateStackSelectionStatus(this.item_stacks[to], true);
        this.dom_selection_indicator.style.setProperty("--selected-slot", to.toString());
    }

    setHealthPercent(percent: number) {
        this.dom_hp.style.setProperty("--hp-percent", `${percent}%`);
    }
}