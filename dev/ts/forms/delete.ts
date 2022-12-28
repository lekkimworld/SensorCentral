import { buttonClose, buttonPerformAction, Form, UICatalog } from "../forms-util";

export type DeleteFormOptions = {
    id: string;
    name: string;
    message: string;
    title: string;
}
export class DeleteForm extends Form<undefined> {
    private options: DeleteFormOptions;
    constructor(options: DeleteFormOptions) {
        super("trash", options.title);
        this.options = options;
    }

    body(catalog: UICatalog) {
        return `
            ${this.options.message}
            ${catalog.disabledTextField({ name: "id", label: "ID", value: this.options.id })}
            ${catalog.disabledTextField({ name: "name", label: "Name", value: this.options.name })}
        `;
    }

    footer() {
        return `${buttonPerformAction("Yes")}
        ${buttonClose("No")}`;
    }
}