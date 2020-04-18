import {HTMLElementBuilder} from "./utils";

const CLASS_NAMES = {
    container: "terminal-root",
    cursor: "terminal-cursor"
};

type QueuedPrinter = {
    resolve: () => void,
    reject: () => void,
    handler: ITerminalPrinter
};

export class TerminalUiCore {
    private last_initialized_printer: QueuedPrinter | null = null;
    private queue: QueuedPrinter[] = [];

    private current_line_element: HTMLElement;
    private readonly cursor_element: HTMLElement;

    constructor(private readonly container: HTMLElement) {
        // Setup terminal with a cursor on an empty line.
        this.cursor_element = new HTMLElementBuilder("span", CLASS_NAMES.cursor)
            .addText("e").element;
        this.current_line_element = this.makeNewLine();
    }

    // Line system
    private makeNewLine(): HTMLElement {
        const line_contents = new HTMLElementBuilder("span").element;
        const line_base = new HTMLElementBuilder("p")
            .addChild(line_contents)
            .addChild(this.cursor_element)
            .element;

        this.container.append(line_base);
        return line_contents;
    }

    // Printing management
    clearContents() {
        // Un-queue all printers
        for (const elem of this.queue) {
            elem.reject();
        }
        this.queue = [];

        // Clear elements & reset state
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.last_initialized_printer = null;
        this.current_line_element = this.makeNewLine();
    }

    print<TPrinter extends ITerminalPrinter>(printer: TPrinter): { printer: TPrinter, on_finished: Promise<void> } {
        return {
            printer,
            on_finished: new Promise<void>((resolve, reject) => {
                this.queue.push({ resolve, reject, handler: printer });
            })
        };
    }

    // Handlers
    onTick() {
        if (this.queue.length === 0) return;
        const active_obj = this.queue[0];
        const initializing_now = active_obj !== this.last_initialized_printer;

        if (initializing_now) {
            this.current_line_element = this.makeNewLine();
            this.last_initialized_printer = active_obj;
        }

        if (active_obj.handler.handlePrintingTick(this.current_line_element!, initializing_now)) {
            this.queue.shift();
            active_obj.resolve();
        } else {
            this.last_initialized_printer = active_obj;
        }
    }
}

export interface ITerminalPrinter {
    handlePrintingTick(line: HTMLElement, is_initial: boolean): boolean;
}