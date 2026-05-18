import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>) => {
    const container = createContainers(elemRoot, "endpoint-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    uiutils.appendTitleRow(titleElem, "Create Endpoint");

    formElem.html(`
        <form id="endpointCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter endpoint name" maxlength="128">
                        <small class="form-text text-muted">Specify the name of the endpoint (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the endpoint.</div>
                    </div>
                    <div class="form-group">
                        <label for="baseUrlInput">Base URL</label>
                        <input type="text" required class="form-control" id="baseUrlInput" placeholder="https://api.example.com" maxlength="1024">
                        <small class="form-text text-muted">Specify the base URL for requests to this endpoint (maximum 1024 characters).</small>
                        <div class="invalid-feedback">You must specify the base URL for the endpoint.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveEndpoint">Save</button>
            <a href="#callouts" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveEndpoint")?.addEventListener("click", async () => {
        const form = document.getElementById("endpointCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const baseUrl = (document.getElementById("baseUrlInput") as HTMLInputElement).value;
        await graphql(`mutation {createCalloutEndpoint(data: {name: "${name}", baseUrl: "${baseUrl}"}){id}}`);
        document.location.hash = "#callouts";
    });
};
