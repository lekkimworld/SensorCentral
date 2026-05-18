import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, secretId: string) => {
    const container = createContainers(elemRoot, "secret-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ calloutSecrets { id, name, value } }`);
    const secrets = data.calloutSecrets || [];
    const secret = secrets.find((s: any) => s.id === secretId);

    if (!secret) {
        formElem.html(`<div class="alert alert-danger">Secret not found.</div><a href="#callouts" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit Secret");

    formElem.html(`
        <form id="secretEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" value="${secret.name}" maxlength="36">
                        <small class="form-text text-muted">Specify the name of the secret (maximum 36 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the secret.</div>
                    </div>
                    <div class="form-group">
                        <label for="valueInput">Value</label>
                        <input type="text" class="form-control" id="valueInput" value="${secret.value}" maxlength="1024">
                        <small class="form-text text-muted">Specify a new value, or leave unchanged (maximum 1024 characters).</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveSecret">Save</button>
            <button type="button" class="btn btn-danger mr-2" id="deleteSecret">Delete</button>
            <a href="#callouts" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveSecret")?.addEventListener("click", async () => {
        const form = document.getElementById("secretEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const value = (document.getElementById("valueInput") as HTMLInputElement).value;
        const valueMutation = value ? `value: "${value}"` : "";
        await graphql(`mutation {updateCalloutSecret(data: {id: "${secretId}", name: "${name}", ${valueMutation}}){id}}`);
        document.location.hash = "#callouts";
    });

    document.getElementById("deleteSecret")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this secret?")) return;
        await graphql(`mutation { deleteCalloutSecret(data: {id: "${secretId}"}) }`);
        document.location.hash = "#callouts";
    });
};
