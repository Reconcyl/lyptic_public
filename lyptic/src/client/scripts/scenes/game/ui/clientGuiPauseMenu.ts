import {HTMLElementBuilder} from "../../../helpers/utils";
import {TerminalUiCore} from "../../../helpers/terminalUiCore";
import {TerminalLinePrinter} from "../../../helpers/terminalUiPrinters";
import {ClientMenuRoot} from "../../menu/clientMenuRoot";

export class ClientGuiPauseMenu {
    public readonly dom_root: HTMLElement;
    private readonly terminal: TerminalUiCore;

    constructor(private readonly resume_handler: () => void, private readonly quit_handler: () => void) {
        this.dom_root = new HTMLElementBuilder("div", "pause-root terminal-ui")
            .element;
        this.terminal = new TerminalUiCore(this.dom_root);
    }

    async openRootMenu() {
        this.terminal.clearContents();
        await this.terminal.print(new TerminalLinePrinter("Lyptic", "title"));
        await this.terminal.print(new TerminalLinePrinter("Game paused", "subtitle"));
        await this.terminal.print(new TerminalLinePrinter("Resume", "link", () => this.resume_handler()));
        await this.terminal.print(new TerminalLinePrinter("Configure game", "link", () => {
            ClientMenuRoot.openTodoMenu(this.terminal, this.openRootMenu.bind(this));
        }));
        await this.terminal.print(new TerminalLinePrinter("Quit game", "link", () => this.quit_handler()));
    }

    tick() {
        this.terminal.onTick();
    }
}