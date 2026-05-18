import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, endpointId: string) => {
    const container = createContainers(elemRoot, "endpoint-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ calloutEndpoints { id, name, baseUrl } }`);
    const endpoints = data.calloutEndpoints || [];
    const endpoint = endpoints.find((e: any) => e.id === endpointId);

    if (!endpoint) {
        formElem.html(`<div class="alert alert-danger">Endpoint not found.</div><a href="#callouts" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit Endpoint");

    formElem.html(`
        <form id="endpointEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" value="${endpoint.name}" maxlength="128">
                        <small class="form-text text-muted">Specify the name of the endpoint (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the endpoint.</div>
                    </div>
                    <div class="form-group">
                        <label for="baseUrlInput">Base URL</label>
                        <input type="text" required class="form-control" id="baseUrlInput" value="${endpoint.baseUrl}" maxlength="1024">
                        <small class="form-text text-muted">Specify the base URL for requests to this endpoint (maximum 1024 characters).</small>
                        <div class="invalid-feedback">You must specify the base URL for the endpoint.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveEndpoint">Save</button>
            <button type="button" class="btn btn-danger mr-2" id="deleteEndpoint">Delete</button>
            <a href="#callouts" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveEndpoint")?.addEventListener("click", async () => {
        const form = document.getElementById("endpointEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const baseUrl = (document.getElementById("baseUrlInput") as HTMLInputElement).value;
        await graphql(`mutation {updateCalloutEndpoint(data: {id: "${endpointId}", name: "${name}", baseUrl: "${baseUrl}"}){id}}`);
        document.location.hash = "#callouts";
    });

    document.getElementById("deleteEndpoint")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this endpoint?")) return;
        await graphql(`mutation { deleteCalloutEndpoint(data: {id: "${endpointId}"}) }`);
        document.location.hash = "#callouts";
    });
};
