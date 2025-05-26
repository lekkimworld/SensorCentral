import { CalloutEndpoint, CalloutSecret } from "../clientside-types";
import { graphqlTyped } from "../fetch-util";
import { EndpointForm } from "../forms/create-edit-endpoint";
import { SecretForm } from "../forms/create-edit-secret";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

// create type for endpoints
type RequestedSecret = Required<Pick<CalloutSecret, "id" | "name" | "value">>;
type RequestedEndpoint = Required<Pick<CalloutEndpoint, "id" | "name" | "baseUrl">>;

export default (elemRoot: JQuery<HTMLElement>) => {
    const updateUI = async () => {
        elemRoot.html("");

        // get data
        type Response = {
            secrets: Array<RequestedSecret>;
            endpoints: Array<RequestedEndpoint>;
        }
        const data = await graphqlTyped<Response>(`
            {
                secrets: calloutSecrets {
                    id
                    name
                    value
                }
                endpoints: calloutEndpoints {
                    id
                    name
                    baseUrl
                }
            }
        `);
        if (data.errors) {
            return;
        }
        
        // add secrets
        secretsUI(elemRoot, data.data!.secrets);

        // call endpoints
        endpointsUI(elemRoot, data.data!.endpoints);
        
    };

    const endpointsUI = (elemRoot: JQuery<HTMLElement>, data: Array<RequestedEndpoint>) => {
        // create containers
        const container = createContainers(elemRoot, "endpoints", "title", "content");

        // do title row
        uiutils.appendTitleRow(container.children!.title.elem, "Endpoints", [
            {
                rel: "create-endpoint",
                icon: "plus",
                click: async function () {
                    new EndpointForm().show();
                },
            },
            {
                rel: "refresh-endpoint",
                icon: "refresh",
                click: async function () {
                    updateUI();
                },
            },
        ]);
        
        if (data.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                headers: ["NAME", "BASEURL"],
                classes: ["", ""],
                rows: data.map((endpoint) => {
                    return {
                        id: endpoint.id,
                        data: endpoint,
                        columns: [endpoint.name, endpoint.baseUrl],
                        click: function () {
                            new EndpointForm(endpoint).show();
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any endpoints defined.");
        }
    }

    const secretsUI = (elemRoot: JQuery<HTMLElement>, data: Array<RequestedSecret>) => {
        // create containers
        const container = createContainers(elemRoot, "secrets", "title", "content");

        // do title row
        uiutils.appendTitleRow(container.children!.title.elem, "Secrets", [
            {
                rel: "create-secret",
                icon: "plus",
                click: async function () {
                    new SecretForm().show();
                },
            },
            {
                rel: "refresh-secret",
                icon: "refresh",
                click: async function () {
                    updateUI();
                },
            },
        ]);
        
        if (data.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                headers: ["NAME", "VALUE"],
                classes: ["", ""],
                rows: data.map((s) => {
                    return {
                        id: s.id,
                        data: s,
                        columns: [s.name, s.value],
                        click: function () {
                            new SecretForm(s).show();
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any secrets defined.");
        }
    }

    // build initial ui
    updateUI();
}
