export class HTMLElementBuilder<TElemKey extends keyof HTMLElementTagNameMap> {
    public readonly element: HTMLElementTagNameMap[TElemKey];
    constructor(tag: TElemKey, class_name?: string) {
        this.element = document.createElement(tag);
        if (class_name) {
            this.element.className = class_name;
        }
    }

    addText(text: string) {
        this.element.append(text);
        return this;
    }

    addChild(child: HTMLElementBuilder<any>): HTMLElementBuilder<TElemKey>;
    addChild(child: HTMLElement): HTMLElementBuilder<TElemKey>;
    addChild(child: HTMLElement | HTMLElementBuilder<any>) {
        this.element.append(child instanceof HTMLElementBuilder ?
            child.element : child);
        return this;
    }

    addChildren(children: Iterable<HTMLElement>) {
        for (const child of children) {
            this.element.append(child);
        }
        return this;
    }
}

export function* mapGenerator<A, B>(original: Iterable<A>, transformer: (a: A) => B) {
    for (const elem of original) {
        yield transformer(elem);
    }
}