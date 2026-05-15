import { Callout, CalloutAuthenticator, CalloutEndpoint } from "../clientside-types";
import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";

type RequestedEndpoint = Required<Pick<CalloutEndpoint, "id" | "name">>;
type RequestedAuthenticator = Required<Pick<CalloutAuthenticator, "id" | "name">>;

const HTTP_METHODS: Record<string, string> = {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    DELETE: "DELETE",
};

const TEMPLATE_HELP = `
<h5>Template Variables</h5>
<p>Use <a href="https://handlebarsjs.com/" target="_blank">Handlebars</a> syntax in your path and body templates. The available variables depend on the event trigger:</p>
<table class="table table-sm table-bordered">
    <thead>
        <tr><th>Variable</th><th>Description</th><th>Triggers</th></tr>
    </thead>
    <tbody>
        <tr><td><code>{{targetId}}</code></td><td>ID of the sensor or device that triggered the event</td><td>All</td></tr>
        <tr><td><code>{{triggerType}}</code></td><td>The trigger type (onSensorSample, onSensorTimeout, onDeviceTimeout)</td><td>All</td></tr>
        <tr><td><code>{{timestamp}}</code></td><td>ISO 8601 UTC timestamp of when the event fired</td><td>All</td></tr>
        <tr><td><code>{{sensorValue}}</code></td><td>The sensor reading that triggered the event</td><td>onSensorSample</td></tr>
        <tr><td><code>{{deviceId}}</code></td><td>The device ID the sensor belongs to</td><td>onSensorSample</td></tr>
        <tr><td><code>{{secrets.&lt;name&gt;}}</code></td><td>Value of the secret with the given name</td><td>All</td></tr>
    </tbody>
</table>
<h6>Examples</h6>
<p><strong>Path template:</strong></p>
<code>/api/notify/{{targetId}}</code>
<p class="mt-2"><strong>Body template (JSON):</strong></p>
<code>{"sensor": "{{targetId}}", "value": {{sensorValue}}, "trigger": "{{triggerType}}", "time": "{{timestamp}}"}</code>
<p class="mt-2"><strong>Using a secret in a header or body:</strong></p>
<code>{"api_key": "{{secrets.my_api_key}}"}</code>

<hr>
<h5>Test Context</h5>
<p>When you click <strong>Test</strong> or <strong>Save &amp; Test</strong>, the callout is executed with these placeholder values:</p>
<table class="table table-sm table-bordered">
    <thead>
        <tr><th>Variable</th><th>Test Value</th></tr>
    </thead>
    <tbody>
        <tr><td><code>targetId</code></td><td>test-000-000</td></tr>
        <tr><td><code>triggerType</code></td><td>manual_test</td></tr>
        <tr><td><code>timestamp</code></td><td><em>(current UTC time)</em></td></tr>
        <tr><td><code>sensorValue</code></td><td><em>(not set)</em></td></tr>
        <tr><td><code>deviceId</code></td><td><em>(not set)</em></td></tr>
    </tbody>
</table>
`;

export default async (elemRoot: JQuery<HTMLElement>, calloutId?: string) => {
    const container = createContainers(elemRoot, "callout-edit", "title", "form", "help");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;
    const helpElem = container.children!.help.elem;

    const data = await graphql(`{
        calloutEndpoints { id, name }
        calloutAuthenticators { id, name }
        ${calloutId ? `callout: callouts { id, name, method, pathTemplate, bodyTemplate, contentType, endpoint { id }, authenticator { id } }` : ""}
    }`);

    const endpoints: RequestedEndpoint[] = data.calloutEndpoints || [];
    const authenticators: RequestedAuthenticator[] = data.calloutAuthenticators || [];
    let callout: Callout | undefined;
    if (calloutId && data.callout) {
        callout = (data.callout as Callout[]).find(c => c.id === calloutId);
    }

    const isEdit = !!callout;
    titleElem.html(`<h3>${isEdit ? "Edit Callout" : "Create Callout"}</h3>`);

    const endpointOptions = endpoints.map(e => `<option value="${e.id}" ${callout?.endpoint?.id === e.id ? "selected" : ""}>${e.name}</option>`).join("");
    const authOptions = authenticators.map(a => `<option value="${a.id}" ${callout?.authenticator?.id === a.id ? "selected" : ""}>${a.name}</option>`).join("");
    const methodOptions = Object.keys(HTTP_METHODS).map(m => `<option value="${m}" ${callout?.method === m ? "selected" : ""}>${m}</option>`).join("");

    formElem.html(`
        <form id="calloutEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter callout name" value="${callout?.name || ""}">
                        <small class="form-text text-muted">A short name to identify this callout</small>
                    </div>
                    <div class="form-group">
                        <label for="endpointIdInput">Endpoint</label>
                        <select class="form-control" id="endpointIdInput" required>
                            <option></option>
                            ${endpointOptions}
                        </select>
                        <small class="form-text text-muted">The base URL endpoint to call</small>
                    </div>
                    <div class="form-group">
                        <label for="methodInput">HTTP Method</label>
                        <select class="form-control" id="methodInput" required>
                            <option></option>
                            ${methodOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="authenticatorIdInput">Authenticator</label>
                        <select class="form-control" id="authenticatorIdInput">
                            <option value="">(None)</option>
                            ${authOptions}
                        </select>
                        <small class="form-text text-muted">Optional — adds authentication headers to the request</small>
                    </div>
                    <div class="form-group">
                        <label for="contentTypeInput">Content-Type</label>
                        <select class="form-control" id="contentTypeInput">
                            <option value="">(None)</option>
                            <option value="application/json" ${(callout?.contentType || "") === "application/json" ? "selected" : ""}>application/json</option>
                            <option value="application/x-www-form-urlencoded" ${(callout?.contentType || "") === "application/x-www-form-urlencoded" ? "selected" : ""}>application/x-www-form-urlencoded</option>
                            <option value="text/plain" ${(callout?.contentType || "") === "text/plain" ? "selected" : ""}>text/plain</option>
                            <option value="text/xml" ${(callout?.contentType || "") === "text/xml" ? "selected" : ""}>text/xml</option>
                        </select>
                        <small class="form-text text-muted">Content-Type header sent with the request</small>
                    </div>
                    <div class="form-group">
                        <label for="pathTemplateInput">Path Template</label>
                        <input type="text" class="form-control" id="pathTemplateInput" placeholder="/path/to/resource" value="${callout?.pathTemplate || ""}">
                        <small class="form-text text-muted">Handlebars template appended to the endpoint base URL (can be empty if base URL is the full path)</small>
                    </div>
                    <div class="form-group">
                        <label for="bodyTemplateInput">Body Template</label>
                        <textarea class="form-control" id="bodyTemplateInput" rows="6" placeholder='{"key": "{{value}}"}'>${callout?.bodyTemplate || ""}</textarea>
                        <small class="form-text text-muted">Optional Handlebars template for the request body</small>
                    </div>
                </div>
                <div class="col-md-6">
                    ${TEMPLATE_HELP}
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveCallout">Save</button>
            <button type="button" class="btn btn-success mr-2" id="saveAndTestCallout">Save &amp; Test</button>
            ${isEdit ? `<button type="button" class="btn btn-outline-success mr-2" id="testCallout">Test</button>` : ""}
            ${isEdit ? `<button type="button" class="btn btn-danger mr-2" id="deleteCallout">Delete</button>` : ""}
            <a href="#callouts" class="btn btn-secondary">Back</a>
            <div id="testResultContainer"></div>
        </form>
    `);

    helpElem.html("");

    const getFormData = () => {
        return {
            name: (document.getElementById("nameInput") as HTMLInputElement).value,
            endpointId: (document.getElementById("endpointIdInput") as HTMLSelectElement).value,
            method: (document.getElementById("methodInput") as HTMLSelectElement).value,
            authenticatorId: (document.getElementById("authenticatorIdInput") as HTMLSelectElement).value,
            contentType: (document.getElementById("contentTypeInput") as HTMLSelectElement).value,
            pathTemplate: (document.getElementById("pathTemplateInput") as HTMLInputElement).value,
            bodyTemplate: (document.getElementById("bodyTemplateInput") as HTMLTextAreaElement).value,
        };
    };

    const validateForm = (): boolean => {
        const form = document.getElementById("calloutEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return false;
        }
        return true;
    };

    const saveCallout = async (): Promise<string | undefined> => {
        const d = getFormData();
        if (isEdit) {
            const result = await graphql(`mutation {
                updateCallout(data: {
                    id: "${callout!.id}"
                    name: "${d.name}"
                    endpointId: "${d.endpointId}"
                    method: ${d.method}
                    ${d.authenticatorId ? `authenticatorId: "${d.authenticatorId}"` : ""}
                    ${d.contentType ? `contentType: "${d.contentType}"` : ""}
                    pathTemplate: "${d.pathTemplate}"
                    ${d.bodyTemplate ? `bodyTemplate: ${JSON.stringify(d.bodyTemplate)}` : ""}
                }) { id }
            }`);
            return result.updateCallout.id;
        } else {
            const result = await graphql(`mutation {
                createCallout(data: {
                    name: "${d.name}"
                    endpointId: "${d.endpointId}"
                    method: ${d.method}
                    ${d.authenticatorId ? `authenticatorId: "${d.authenticatorId}"` : ""}
                    ${d.contentType ? `contentType: "${d.contentType}"` : ""}
                    pathTemplate: "${d.pathTemplate}"
                    ${d.bodyTemplate ? `bodyTemplate: ${JSON.stringify(d.bodyTemplate)}` : ""}
                }) { id }
            }`);
            return result.createCallout.id;
        }
    };

    const runTest = async (id: string) => {
        const container = document.getElementById("testResultContainer")!;
        container.innerHTML = `<div class="alert alert-info mt-3">Testing...</div>`;
        try {
            const result = await graphql(`mutation { testCallout(id: "${id}") { success, message } }`);
            const r = result.testCallout;
            container.innerHTML = `<div class="alert ${r.success ? "alert-success" : "alert-danger"} mt-3">
                <strong>${r.success ? "Success" : "Failed"}</strong>
                <pre style="white-space: pre-wrap; word-break: break-all; margin-top: 8px; margin-bottom: 0;">${escapeHtml(r.message)}</pre>
            </div>`;
        } catch (err: any) {
            container.innerHTML = `<div class="alert alert-danger mt-3"><strong>Error</strong><pre style="white-space: pre-wrap; word-break: break-all; margin-top: 8px; margin-bottom: 0;">${escapeHtml(err.message)}</pre></div>`;
        }
    };

    // save handler
    document.getElementById("saveCallout")?.addEventListener("click", async () => {
        if (!validateForm()) return;
        await saveCallout();
        document.location.hash = "#callouts";
    });

    // save & test handler
    document.getElementById("saveAndTestCallout")?.addEventListener("click", async () => {
        if (!validateForm()) return;
        const id = await saveCallout();
        if (!id) return;
        if (!isEdit) {
            document.location.hash = `#callouts/edit/${id}`;
            return;
        }
        await runTest(id);
    });

    // test handler (without saving)
    document.getElementById("testCallout")?.addEventListener("click", async () => {
        await runTest(callout!.id!);
    });

    // delete handler
    document.getElementById("deleteCallout")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this callout?")) return;
        await graphql(`mutation { deleteCallout(data: {id: "${callout!.id}"}) }`);
        document.location.hash = "#callouts";
    });
};

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
