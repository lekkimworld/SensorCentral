import { CalloutAuthenticator, CalloutEndpoint, CalloutSecret } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, buttonPerformDestructiveAction, ClickEvent, DataEvent, EVENTS, Form, InitEvent, UICatalog } from "../forms-util";

type RequestedEndpoint = Required<Pick<CalloutEndpoint, "id" | "name">>;
type RequestedSecret = Required<Pick<CalloutSecret, "id" | "name">>;

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

type AuthenticatorContext = CalloutAuthenticator & {
    template?: string;
    endpoint?: { id: string };
    templateMappings?: Array<{ name: string; secret: { id: string } }>;
};

export class AuthenticatorForm extends Form<AuthenticatorContext> {
    private endpoints: Array<RequestedEndpoint> = [];
    private secrets: Array<RequestedSecret> = [];

    constructor(auth?: AuthenticatorContext) {
        super("createAuthenticator", auth ? "Edit Authenticator" : "Create Authenticator", auth);

        this.addEventListener("click", async (e) => {
            const ev = e as ClickEvent;
            if ("delete" === ev.rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation { deleteCalloutAuthenticator(data: {id: "${this.ctx!.id}"}) }`);
                document.location.reload();
            }
        });

        this.addEventListener(EVENTS.data, async (e) => {
            const data = (e as DataEvent).data;
            const template = data.template as string;
            const placeholders = TEMPLATE_PLACEHOLDERS[template] || [];
            const mappings = placeholders.map(p => {
                const secretId = data[`mapping_${p}`] as string;
                return `{name: "${p}", secretId: "${secretId}"}`;
            }).join(", ");

            if (this.ctx?.id) {
                await graphql(`mutation {
                    createCalloutAuthenticator(data: {
                        name: "${data.name}"
                        endpointId: "${data.endpointId}"
                        template: ${template}
                        templateMappings: [${mappings}]
                    }) { id }
                }`);
                await graphql(`mutation { deleteCalloutAuthenticator(data: {id: "${this.ctx.id}"}) }`);
            } else {
                await graphql(`mutation {
                    createCalloutAuthenticator(data: {
                        name: "${data.name}"
                        endpointId: "${data.endpointId}"
                        template: ${template}
                        templateMappings: [${mappings}]
                    }) { id }
                }`);
            }
            document.location.reload();
        });

        this.addEventListener("init", (e: Event) => {
            const catalog = (e as InitEvent).catalog;
            if (this.ctx) {
                catalog.get("name").value = this.ctx.name || "";
                catalog.get("endpointId").value = this.ctx.endpoint?.id || "";
                catalog.get("template").value = this.ctx.template || "";
            }
            this.toggleMappingFields(catalog);
            const templateSelect = document.getElementById("templateInput") as HTMLSelectElement;
            templateSelect?.addEventListener("change", () => this.toggleMappingFields(catalog));

            if (this.ctx?.templateMappings) {
                for (const m of this.ctx.templateMappings) {
                    const ctrl = document.getElementById(`mapping_${m.name}Input`) as HTMLSelectElement;
                    if (ctrl) ctrl.value = m.secret.id;
                }
            }
        });
    }

    private toggleMappingFields(catalog: UICatalog) {
        const template = catalog.value("template");
        const allPlaceholders = Object.keys(TEMPLATE_PLACEHOLDERS).reduce((arr, k) => arr.concat(TEMPLATE_PLACEHOLDERS[k]), [] as string[]);
        for (const p of allPlaceholders) {
            const field = document.getElementById(`mapping_${p}Input`)?.closest(".form-group") as HTMLElement;
            if (field) {
                const show = (TEMPLATE_PLACEHOLDERS[template] || []).includes(p);
                field.style.display = show ? "" : "none";
            }
        }
    }

    async loadData(): Promise<void> {
        const data = await graphql(`{
            calloutEndpoints { id, name }
            calloutSecrets { id, name }
        }`);
        this.endpoints = data.calloutEndpoints || [];
        this.secrets = data.calloutSecrets || [];
    }

    body(catalog: UICatalog) {
        const secretOptions = this.secrets.reduce((prev, s) => {
            prev[s.id] = s.name;
            return prev;
        }, {} as Record<string, string>);

        const allPlaceholders = Object.keys(TEMPLATE_PLACEHOLDERS).reduce((arr, k) => {
            for (const p of TEMPLATE_PLACEHOLDERS[k]) { if (arr.indexOf(p) === -1) arr.push(p); }
            return arr;
        }, [] as string[]);
        const mappingFields = allPlaceholders.map(p => catalog.dropdown({
            name: `mapping_${p}`,
            label: `Secret for "${p}"`,
            addBlank: true,
            required: false,
            dropdownOptions: secretOptions,
            fieldExplanation: `Map the "${p}" placeholder to a secret`,
        })).join("\n");

        return `<form id="${this.name}Form" novalidate>
            ${catalog.textField({
                name: "name",
                label: "Name",
                placeholder: "Enter authenticator name",
                fieldExplanation: "A short name for this authenticator",
                required: true,
                validationText: "You must specify a name.",
            })}
            ${catalog.dropdown({
                name: "endpointId",
                label: "Token Endpoint",
                addBlank: true,
                required: true,
                dropdownOptions: this.endpoints.reduce((prev, e) => {
                    prev[e.id] = e.name;
                    return prev;
                }, {} as Record<string, string>),
                fieldExplanation: "The endpoint used to fetch an access token (not needed for static tokens)",
            })}
            ${catalog.dropdown({
                name: "template",
                label: "Template",
                addBlank: true,
                required: true,
                dropdownOptions: TEMPLATES,
                fieldExplanation: "The authentication strategy to use",
            })}
            ${mappingFields}
        </form>`;
    }

    footer() {
        return `
            ${this.ctx ? buttonPerformDestructiveAction() : ""}
            ${buttonClose()}
            ${buttonPerformAction()}
        `;
    }

    async getData(catalog: UICatalog) {
        const template = catalog.value("template");
        const placeholders = TEMPLATE_PLACEHOLDERS[template] || [];
        const data: Record<string, string> = {
            name: catalog.value("name"),
            endpointId: catalog.value("endpointId"),
            template,
        };
        for (const p of placeholders) {
            data[`mapping_${p}`] = catalog.value(`mapping_${p}`);
        }
        return data;
    }
}
