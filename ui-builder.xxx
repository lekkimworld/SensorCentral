const fetcher = require("./fetch-util");

export abstract class Container {
    id: string;
    element!: JQuery<HTMLDivElement>;
    children: Container[] = [];

    constructor(id: string) {
        this.id = id;
    }

    addChildContainer(c: Container): Container {
        if (!this.children) {
            this.children = [c];
        } else {
            this.children.push(c);
        }
        return this;
    }

    async init(): Promise<void> {}
    async build(): Promise<void> {}
}

export abstract class BreadcrumbContainer extends Container {
    private query: string;
    private elements!: any[];

    constructor(id: string, query: string) {
        super(id);
        this.query = query;
    }
    abstract mapData(data: any) : string[];

    async init(): Promise<void> {
        const data = await fetcher.graphql(this.query);
        this.elements = this.mapData(data);
    }
    async build(): Promise<void> {
        const html = this.elements.map(o => {
            if (!o.id) return o.text;
            if (o.id.indexOf("#") === 0) return `<a href="${o.id}">${o.text}</a>`;
            return `<a href="#configuration/${o.id}">${o.text}</a>`;
        }).join(" &gt; ");
        this.element.append(html);
    }
}

const recurseContainers = async (parent: Element, parentId: string | undefined, containers: Container[]) => {
    for (let container of containers) {
        // create element
        const child = document.createElement("div");
        child.id = parentId ? `${parentId}-${container.id}` : container.id;
        parent.append(child);
        container.element = $(child);

        // call init and then build
        container.init().then(() => container.build());

        if (container.children) {
            // recurse
            recurseContainers(child, container.id, container.children);
        }
    }
};

export const buildContainers = (root: Element, ...containers: Container[]) => {
    // build hierarchy
    recurseContainers(root, undefined, containers);
};
