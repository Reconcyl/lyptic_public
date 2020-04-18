import {HTMLElementBuilder} from "../../../helpers/utils";

export class ClientGuiItemStack {
    public readonly dom_root: HTMLElement;
    private readonly dom_count: HTMLElement;

    constructor(initial_material: number | null, initial_count: number) {
        this.dom_count = new HTMLElementBuilder("span", "item-count")
            .addText(initial_count.toString()).element;

        this.dom_root = new HTMLElementBuilder("div", "item-stack")
            .addChild(this.dom_count)
            .element;

        this.updateIcon(initial_material);
    }

    updateIcon(texture_idx: number | null) {
        const {classList, style} = this.dom_root;
        if (texture_idx == null) {
            classList.remove("textured");
        } else {
            classList.add("textured");
            style.setProperty("--IS-disp-material", texture_idx.toString());
        }
    }

    updateCount(count: number) {
        this.dom_count.innerText = count.toString();
    }
}