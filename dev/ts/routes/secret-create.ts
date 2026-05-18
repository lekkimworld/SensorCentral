import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>) => {
    const container = createContainers(elemRoot, "secret-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    uiutils.appendTitleRow(titleElem, "Create Secret");

    formElem.html(`
        <form id="secretCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter secret name" maxlength="36">
                        <small class="form-text text-muted">Specify the name of the secret (maximum 36 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the secret.</div>
                    </div>
                    <div class="form-group">
                        <label for="valueInput">Value</label>
                        <input type="text" required class="form-control" id="valueInput" placeholder="Enter secret value" maxlength="1024">
                        <small class="form-text text-muted">Specify the value of the secret (maximum 1024 characters).</small>
                        <div class="invalid-feedback">You must specify the value for the secret.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveSecret">Save</button>
            <a href="#callouts" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveSecret")?.addEventListener("click", async () => {
        const form = document.getElementById("secretCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const value = (document.getElementById("valueInput") as HTMLInputElement).value;
        await graphql(`mutation {createCalloutSecret(data: {name: "${name}", value: "${value}"}){id}}`);
        document.location.hash = "#callouts";
    });
};
