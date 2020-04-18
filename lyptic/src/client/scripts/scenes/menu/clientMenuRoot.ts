import {BaseClientScene, ClientEngine} from "../engine/clientEngine";
import {HTMLElementBuilder} from "../../helpers/utils";
import {TerminalUiCore} from "../../helpers/terminalUiCore";
import {TerminalInputPrinter, TerminalLinePrinter} from "../../helpers/terminalUiPrinters";
import {ClientGameWorld} from "../game/clientGameWorld";


export class ClientMenuRoot extends BaseClientScene {
    private readonly dom_root: HTMLElement;
    private readonly terminal: TerminalUiCore;

    constructor(private readonly engine: ClientEngine) {
        super();
        this.dom_root = new HTMLElementBuilder("div", "menu root terminal-ui").element;
        this.terminal = new TerminalUiCore(this.dom_root);
        document.body.append(this.dom_root);

        this.openMainMenu().then();
    }

    private async printText(text: string, class_name: string, click_handler: (() => void) | null = null) {
        return this.terminal.print(new TerminalLinePrinter(text, class_name, click_handler)).on_finished;
    }

    private async openMainMenu() {
        this.terminal.clearContents();
        await this.printText("Lyptic", "title");
        await this.printText("I can't believe it's not a roguelike", "subtitle");
        await this.printText("Join world", "text", () => {
            queueMicrotask(this.openStartGame.bind(this));
        });

        await this.printText("Configure game", "text", () => {
            queueMicrotask(this.openTodoMenu.bind(this));
        });

        await this.printText("More info", "text", () => {
            queueMicrotask(this.openTodoMenu.bind(this));
        });
    }

    private async openStartGame() {
        this.terminal.clearContents();
        await this.printText("Lyptic", "title");
        await this.printText("Join world:", "subtitle");
        await this.printText("Enter world seed:", "text");

        const seed_input = new TerminalInputPrinter();
        await this.terminal.print(seed_input).on_finished;

        await this.printText("", "text");
        await this.printText("Join game", "text", () => {
           this.joinGame(seed_input.input.value);
        });
        await this.printText("Back to menu", "text", () => {
            queueMicrotask(this.openMainMenu.bind(this));
        });
    }

    private async joinGame(seed: string) {
        await this.printText("Please wait...", "text");
        this.engine.swapScene(root => new ClientGameWorld(root, seed));
    }

    private async openTodoMenu() {
        await ClientMenuRoot.openTodoMenu(this.terminal, this.openMainMenu.bind(this));
    }

    public static async openTodoMenu(terminal: TerminalUiCore, on_go_back: () => void) {  // TODO
        terminal.clearContents();
        await terminal.print(new TerminalLinePrinter("Unfinished Menu:", "subtitle"));
        await terminal.print(new TerminalLinePrinter("This menu is unfinished.", "text"));
        await terminal.print(new TerminalLinePrinter("Go back", "text", () => {
            queueMicrotask(on_go_back);
        }));
    }

    onTick(engine: ClientEngine) {
        this.terminal.onTick();
    }

    onDetached(engine: ClientEngine) {
        this.dom_root.remove();
    }
}