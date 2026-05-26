import { Callout, CalloutAuthenticator, CalloutEndpoint, CalloutSecret } from "../clientside-types";
import { graphql, graphqlTyped } from "../fetch-util";
import { TestResultForm } from "../forms/test-result";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { formatDMYTime } from "../date-utils";

type RequestedSecret = Required<Pick<CalloutSecret, "id" | "name" | "value">> & { systemManaged: boolean };
type RequestedEndpoint = Required<Pick<CalloutEndpoint, "id" | "name" | "baseUrl">> & { systemManaged: boolean };
type RequestedAuthenticator = Required<Pick<CalloutAuthenticator, "id" | "name">> & { systemManaged: boolean; template: string; endpoint: { id: string }; templateMappings: Array<{ name: string; secret: { id: string } }> };
type RequestedCallout = Required<Pick<Callout, "id" | "name" | "method" | "pathTemplate">> & Pick<Callout, "bodyTemplate" | "endpoint" | "authenticator"> & { systemManaged: boolean };

export default (elemRoot: JQuery<HTMLElement>) => {
    const updateUI = async () => {
        elemRoot.html("");

        type Response = {
            secrets: Array<RequestedSecret>;
            endpoints: Array<RequestedEndpoint>;
            authenticators: Array<RequestedAuthenticator>;
            callouts: Array<RequestedCallout>;
        }
        const data = await graphqlTyped<Response>(`
            {
                secrets: calloutSecrets {
                    id
                    name
                    value
                    systemManaged
                }
                endpoints: calloutEndpoints {
                    id
                    name
                    baseUrl
                    systemManaged
                }
                authenticators: calloutAuthenticators {
                    id
                    name
                    template
                    systemManaged
                    endpoint { id }
                    templateMappings { name, secret { id } }
                }
                callouts {
                    id
                    name
                    method
                    pathTemplate
                    bodyTemplate
                    contentType
                    systemManaged
                    endpoint { id }
                    authenticator { id }
                }
            }
        `);
        if (data.errors) {
            return;
        }

        secretsUI(elemRoot, data.data!.secrets);
        endpointsUI(elemRoot, data.data!.endpoints);
        authenticatorsUI(elemRoot, data.data!.authenticators);
        calloutsUI(elemRoot, data.data!.callouts);
        eventLogUI(elemRoot);
    };

    const authenticatorsUI = (elemRoot: JQuery<HTMLElement>, data: Array<RequestedAuthenticator>) => {
        const container = createContainers(elemRoot, "authenticators", "title", "content");

        uiutils.appendTitleRow(container.children!.title.elem, "Authenticators", [
            {
                rel: "create-authenticator",
                icon: "plus",
                click: async function () {
                    document.location.hash = "authenticators/create";
                },
            },
            {
                rel: "refresh-authenticator",
                icon: "refresh",
                click: async function () {
                    updateUI();
                },
            },
        ]);

        if (data.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                actions: [
                    {
                        rel: "test-authenticator",
                        icon: "play",
                        click: async (actionCtx: any) => {
                            const result = await graphql(`mutation { testCalloutAuthenticator(id: "${actionCtx.id}") { success, message } }`);
                            new TestResultForm("Test Authenticator", result.testCalloutAuthenticator).show();
                        },
                    },
                ],
                headers: ["NAME", "TEMPLATE"],
                classes: ["", ""],
                rows: data.map((a) => {
                    return {
                        id: a.id,
                        data: a,
                        columns: [a.systemManaged ? `${a.name} <span class="badge badge-secondary">system</span>` : a.name, a.template],
                        click: a.systemManaged ? undefined : function () {
                            document.location.hash = `authenticators/edit/${a.id}`;
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any authenticators defined.");
        }
    };

    const calloutsUI = (elemRoot: JQuery<HTMLElement>, data: Array<RequestedCallout>) => {
        const container = createContainers(elemRoot, "callouts", "title", "content");

        uiutils.appendTitleRow(container.children!.title.elem, "Callouts", [
            {
                rel: "create-callout",
                icon: "plus",
                click: async function () {
                    document.location.hash = "#callouts/create";
                },
            },
            {
                rel: "refresh-callout",
                icon: "refresh",
                click: async function () {
                    updateUI();
                },
            },
        ]);

        if (data.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                actions: [
                    {
                        rel: "test-callout",
                        icon: "play",
                        click: async (actionCtx: any) => {
                            const result = await graphql(`mutation { testCallout(id: "${actionCtx.id}") { success, message } }`);
                            new TestResultForm("Test Callout", result.testCallout).show();
                        },
                    },
                ],
                headers: ["NAME", "METHOD"],
                classes: ["", ""],
                rows: data.map((c) => {
                    return {
                        id: c.id,
                        data: c,
                        columns: [c.systemManaged ? `${c.name} <span class="badge badge-secondary">system</span>` : c.name, c.method],
                        click: c.systemManaged ? undefined : function () {
                            document.location.hash = `#callouts/edit/${c.id}`;
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any callouts defined.");
        }
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
                    document.location.hash = "endpoints/create";
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
                        columns: [endpoint.systemManaged ? `${endpoint.name} <span class="badge badge-secondary">system</span>` : endpoint.name, endpoint.baseUrl],
                        click: endpoint.systemManaged ? undefined : function () {
                            document.location.hash = `endpoints/edit/${endpoint.id}`;
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
                    document.location.hash = "secrets/create";
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
                        columns: [s.systemManaged ? `${s.name} <span class="badge badge-secondary">system</span>` : s.name, s.value],
                        click: s.systemManaged ? undefined : function () {
                            document.location.hash = `secrets/edit/${s.id}`;
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any secrets defined.");
        }
    }

    const eventLogUI = async (elemRoot: JQuery<HTMLElement>) => {
        const container = createContainers(elemRoot, "eventlog", "title", "content");

        uiutils.appendTitleRow(container.children!.title.elem, "Event Activity Log", [
            {
                rel: "refresh-eventlog",
                icon: "refresh",
                click: async function () {
                    await loadEventLog(container.children!.content.elem);
                },
            },
        ]);

        await loadEventLog(container.children!.content.elem);
    };

    const loadEventLog = async (contentElem: JQuery<HTMLElement>) => {
        contentElem.html("");
        const data = await graphql(`{ eventLog(limit: 20) { timestamp, triggerType, targetId, targetName, targetPath, actionType, actionDetail, success, error, request, response } }`);
        const entries = (data.eventLog || []) as Array<{
            timestamp: string;
            triggerType: string;
            targetId: string;
            targetName: string;
            targetPath?: string;
            actionType: string;
            actionDetail: string;
            success: boolean;
            error?: string;
            request?: string;
            response?: string;
        }>;

        if (!entries.length) {
            contentElem.html("No event activity recorded yet.");
            return;
        }

        uiutils.appendDataTable(contentElem, {
            actions: [
                {
                    rel: "event-details",
                    icon: "info",
                    click: (actionCtx: any) => {
                        const entry = actionCtx.data;
                        let message = "";
                        if (entry.error) message += `Error: ${entry.error}\n\n`;
                        if (entry.request) message += `--- Request ---\n${entry.request}\n\n`;
                        if (entry.response) message += `--- Response ---\n${entry.response}`;
                        if (!message) message = entry.success ? "Action completed successfully." : "No details available.";
                        new TestResultForm(
                            `${entry.actionType}: ${entry.actionDetail}`,
                            { success: entry.success, message: message.trim() }
                        ).show();
                    },
                },
            ],
            headers: ["TIME", "TRIGGER", "TARGET", "ACTION", "DETAIL", "STATUS"],
            classes: ["", "", "d-none d-md-table-cell", "", "d-none d-md-table-cell", ""],
            rows: entries.map((e, idx) => ({
                id: String(idx),
                data: e,
                columns: [
                    formatDMYTime(e.timestamp),
                    e.triggerType,
                    e.targetPath
                        ? `<a href="${e.targetPath}">${e.targetName}</a>`
                        : e.targetName,
                    e.actionType,
                    e.actionDetail,
                    e.success
                        ? '<span class="text-success">OK</span>'
                        : `<span class="text-danger" title="${(e.error || "").replace(/"/g, "&quot;")}">FAIL</span>`,
                ],
            })),
        });

        contentElem.append(`<a href="#eventlog" class="btn btn-sm btn-outline-secondary mt-2">Show all events</a>`);
    };

    // build initial ui
    updateUI();
}
