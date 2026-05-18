import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

type EndpointOption = { id: string; name: string };

export default async (elemRoot: JQuery<HTMLElement>, sensorId: string) => {
    const container = createContainers(elemRoot, "event-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ endpoints { id, name } }`);
    const endpoints: EndpointOption[] = data.endpoints || [];

    uiutils.appendTitleRow(titleElem, "Create Event");

    const endpointOptions = endpoints.map(e => `<option value="${e.id}">${e.name}</option>`).join("");

    formElem.html(`
        <form id="eventCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="endpointInput">Endpoint</label>
                        <select class="form-control" id="endpointInput" required>
                            <option></option>
                            ${endpointOptions}
                        </select>
                        <small class="form-text text-muted">Select the endpoint to use for the request.</small>
                        <div class="invalid-feedback">You must select an endpoint.</div>
                    </div>
                    <div class="form-group">
                        <label for="methodInput">Method</label>
                        <select class="form-control" id="methodInput" required>
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                        </select>
                        <small class="form-text text-muted">Select the method to use for the request.</small>
                    </div>
                    <div class="form-group">
                        <label for="contentTypeInput">Content-Type</label>
                        <select class="form-control" id="contentTypeInput" required>
                            <option value="JSON">application/json</option>
                            <option value="FORM">application/x-www-form-urlencoded</option>
                        </select>
                        <small class="form-text text-muted">Select the content-type to use for the request.</small>
                    </div>
                    <div class="form-group">
                        <label for="pathInput">Path</label>
                        <input type="text" class="form-control" id="pathInput" placeholder="Enter path" maxlength="1024">
                        <small class="form-text text-muted">Specify the path to make the request to (maximum 1024 characters).</small>
                    </div>
                    <div class="form-group">
                        <label for="bodyTemplateInput">Body Template</label>
                        <textarea class="form-control" id="bodyTemplateInput" rows="4" placeholder="Specify the body template" maxlength="1024"></textarea>
                        <small class="form-text text-muted">Specify the body template to use (if any, maximum 1024 characters).</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveEvent">Save</button>
            <button type="button" class="btn btn-secondary" id="backBtn">Back</button>
        </form>
    `);

    document.getElementById("backBtn")?.addEventListener("click", () => history.back());

    document.getElementById("saveEvent")?.addEventListener("click", async () => {
        const form = document.getElementById("eventCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const endpointId = (document.getElementById("endpointInput") as HTMLSelectElement).value;
        const method = (document.getElementById("methodInput") as HTMLSelectElement).value;
        const contentType = (document.getElementById("contentTypeInput") as HTMLSelectElement).value;
        const path = (document.getElementById("pathInput") as HTMLInputElement).value;
        const bodyTemplate = (document.getElementById("bodyTemplateInput") as HTMLTextAreaElement).value;
        const bodyField = bodyTemplate ? `bodyTemplate: "${bodyTemplate.replace(/"/g, '\\"')}"` : "";

        await graphql(`mutation {createEvent(data: {
            sensorId: "${sensorId}"
            endpointId: "${endpointId}"
            method: ${method}
            path: "${path}"
            contentType: ${contentType}
            ${bodyField}
        }){id}}`);
        history.back();
    });
};
