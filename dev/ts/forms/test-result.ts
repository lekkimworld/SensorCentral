import { buttonClose, Form, UICatalog } from "../forms-util";

type TestResultContext = {
    success: boolean;
    message: string;
};

export class TestResultForm extends Form<TestResultContext> {
    constructor(title: string, result: TestResultContext) {
        super("testResult", title, result);
    }

    body(catalog: UICatalog) {
        const statusClass = this.ctx!.success ? "text-success" : "text-danger";
        const statusText = this.ctx!.success ? "Success" : "Failed";
        return `<form id="${this.name}Form" novalidate>
            <p class="${statusClass}"><strong>${statusText}</strong></p>
            <pre style="white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 13px;">${this.escapeHtml(this.ctx!.message)}</pre>
        </form>`;
    }

    footer() {
        return buttonClose("OK");
    }

    private escapeHtml(str: string): string {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}
