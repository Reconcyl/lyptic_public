import {ITerminalPrinter} from "./terminalUiCore";
import {HTMLElementBuilder} from "./utils";

export class TerminalLinePrinter implements ITerminalPrinter {
    constructor(
        private text_buffer: string, private readonly line_class: string,
        private readonly click_handler: (() => void) | null = null) {}

    handlePrintingTick(line: HTMLElement, is_initial: boolean): boolean {
        if (is_initial) {
            line.classList.add(this.line_class);
            if (this.click_handler != null) {
                line.classList.add("link");
                line.addEventListener("click", () => this.click_handler!());
            }
        }

        line.append(this.text_buffer.substr(0, 4));
        this.text_buffer = this.text_buffer.substr(4);
        return this.text_buffer.length === 0;
    }
}

export class TerminalInputPrinter implements ITerminalPrinter {
    public readonly input: HTMLInputElement;
    constructor() {
        this.input = new HTMLElementBuilder("input", "text-input").element;
        this.input.spellcheck = false;
        this.input.autocomplete = "off";
    }

    handlePrintingTick(line: HTMLElement, is_initial: boolean): boolean {
        line.append(this.input);
        return true;
    }
}