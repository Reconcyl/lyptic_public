import {HTMLElementBuilder} from "../../../helpers/utils";
import {ClientGuiHotBar} from "./clientGuiHotBar";
import {ClientGuiInventory} from "./clientGuiInventory";
import {ClientGuiPauseMenu} from "./clientGuiPauseMenu";

export type ClientGuiViewId = null | "inventory" | "pause" | "death";
export class ClientGuiRoot {
    public readonly dom_root: HTMLElement;

    constructor(public active_view: ClientGuiViewId,
                public readonly hot_bar: ClientGuiHotBar,
                public readonly inventory_menu: ClientGuiInventory,
                public readonly pause_menu: ClientGuiPauseMenu) {
        this.dom_root = new HTMLElementBuilder("div", "gui root")
            .addChild(new HTMLElementBuilder("div", "crosshair"))
            .addChild(this.hot_bar.dom_root)
            .addChild(new HTMLElementBuilder("div", "window-container")
                .addChild(this.inventory_menu.dom_root)
                .addChild(this.pause_menu.dom_root)
                .addChild(new HTMLElementBuilder("h1", "death-text").addText("You died!")))
            .element;

        this.setActiveGui(this.active_view);
    }

    setActiveGui(id: ClientGuiViewId) {
        if (id != null) {
            this.dom_root.setAttribute("screen", id);
            if (id === "pause") this.pause_menu.openRootMenu().then();
        } else {
            this.dom_root.removeAttribute("screen");
        }
        this.active_view = id;
    }

    tick() {
        if (this.active_view === "pause")
            this.pause_menu.tick();
    }
}