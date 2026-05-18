import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

const TEMPLATES: Record<string, string> = {
    STATIC_BEARERTOKEN: "Static Bearer Token",
    DATACLOUD_CLIENTCREDENTIALS: "Data Cloud Client Credentials",
    DATACLOUD_WEBSDK: "Data Cloud WebSDK",
    CLIENTCREDENTIALS_OAUTH: "OAuth Client Credentials",
};

const TEMPLATE_PLACEHOLDERS: Record<string, string[]> = {
    STATIC_BEARERTOKEN: ["token"],
    DATACLOUD_CLIENTCREDENTIALS: ["client_id", "client_secret"],
    DATACLOUD_WEBSDK: ["app_source_id", "device_id"],
    CLIENTCREDENTIALS_OAUTH: ["client_id", "client_secret", "scope"],
};

type SecretOption = { id: string; name: string };
type EndpointOption = { id: string; name: string };

export default async (elemRoot: JQuery<HTMLElement>, authenticatorId: string) => {
    const container = createContainers(elemRoot, "authenticator-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{
        calloutEndpoints { id, name }
        calloutSecrets { id, name }
        calloutAuthenticators { id, name, template, endpoint { id }, templateMappings { name, secret { id } } }
    }`);
    const endpoints: EndpointOption[] = data.calloutEndpoints || [];
    const secrets: SecretOption[] = data.calloutSecrets || [];
    const authenticators = data.calloutAuthenticators || [];
    const auth = authenticators.find((a: any) => a.id === authenticatorId);

    if (!auth) {
        formElem.html(`<div class="alert alert-danger">Authenticator not found.</div><a href="#callouts" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit Authenticator");

    const endpointOptions = endpoints.map(e => `<option value="${e.id}" ${auth.endpoint?.id === e.id ? "selected" : ""}>${e.name}</option>`).join("");
    const secretOptions = secrets.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    const templateOptions = Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${auth.template === k ? "selected" : ""}>${v}</option>`).join("");

    const allPlaceholders = [...new Set(Object.values(TEMPLATE_PLACEHOLDERS).flat())];
    const activePlaceholders = TEMPLATE_PLACEHOLDERS[auth.template] || [];
    const existingMappings: Record<string, string> = {};
    if (auth.templateMappings) {
        for (const m of auth.templateMappings) {
            existingMappings[m.name] = m.secret.id;
        }
    }

    const mappingFields = allPlaceholders.map(p => {
        const show = activePlaceholders.includes(p);
        const selectedSecretId = existingMappings[p] || "";
        const opts = secrets.map(s => `<option value="${s.id}" ${s.id === selectedSecretId ? "selected" : ""}>${s.name}</option>`).join("");
        return `
            <div class="form-group mapping-field" id="mapping-${p}-group" style="${show ? "" : "display:none"}">
                <label for="mapping_${p}Input">Secret for "${p}"</label>
                <select class="form-control" id="mapping_${p}Input">
                    <option></option>
                    ${opts}
                </select>
                <small class="form-text text-muted">Map the "${p}" placeholder to a secret</small>
            </div>
        `;
    }).join("");

    formElem.html(`
        <form id="authenticatorEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" value="${auth.name}" maxlength="128">
                        <small class="form-text text-muted">A short name for this authenticator.</small>
                        <div class="invalid-feedback">You must specify a name.</div>
                    </div>
                    <div class="form-group">
                        <label for="endpointIdInput">Token Endpoint</label>
                        <select class="form-control" id="endpointIdInput" required>
                            <option></option>
                            ${endpointOptions}
                        </select>
                        <small class="form-text text-muted">The endpoint used to fetch an access token.</small>
                        <div class="invalid-feedback">You must select an endpoint.</div>
                    </div>
                    <div class="form-group">
                        <label for="templateInput">Template</label>
                        <select class="form-control" id="templateInput" required>
                            <option></option>
                            ${templateOptions}
                        </select>
                        <small class="form-text text-muted">The authentication strategy to use.</small>
                        <div class="invalid-feedback">You must select a template.</div>
                    </div>
                    ${mappingFields}
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveAuthenticator">Save</button>
            <button type="button" class="btn btn-danger mr-2" id="deleteAuthenticator">Delete</button>
            <a href="#callouts" class="btn btn-secondary">Back</a>
        </form>
    `);

    const toggleMappingFields = () => {
        const template = (document.getElementById("templateInput") as HTMLSelectElement).value;
        const active = TEMPLATE_PLACEHOLDERS[template] || [];
        for (const p of allPlaceholders) {
            const group = document.getElementById(`mapping-${p}-group`);
            if (group) group.style.display = active.includes(p) ? "" : "none";
        }
    };

    document.getElementById("templateInput")?.addEventListener("change", toggleMappingFields);

    document.getElementById("saveAuthenticator")?.addEventListener("click", async () => {
        const form = document.getElementById("authenticatorEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const endpointId = (document.getElementById("endpointIdInput") as HTMLSelectElement).value;
        const template = (document.getElementById("templateInput") as HTMLSelectElement).value;
        const placeholders = TEMPLATE_PLACEHOLDERS[template] || [];
        const mappings = placeholders.map(p => {
            const secretId = (document.getElementById(`mapping_${p}Input`) as HTMLSelectElement).value;
            return `{name: "${p}", secretId: "${secretId}"}`;
        }).join(", ");

        // Delete old and create new (authenticator update is replace-based)
        await graphql(`mutation {
            createCalloutAuthenticator(data: {
                name: "${name}"
                endpointId: "${endpointId}"
                template: ${template}
                templateMappings: [${mappings}]
            }) { id }
        }`);
        await graphql(`mutation { deleteCalloutAuthenticator(data: {id: "${authenticatorId}"}) }`);
        document.location.hash = "#callouts";
    });

    document.getElementById("deleteAuthenticator")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this authenticator?")) return;
        await graphql(`mutation { deleteCalloutAuthenticator(data: {id: "${authenticatorId}"}) }`);
        document.location.hash = "#callouts";
    });
};
