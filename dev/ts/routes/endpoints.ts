import { Endpoint } from "../clientside-types";
import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../../js/ui-utils";
import {EndpointForm} from "../forms/create-edit-endpoint";

// create type for endpoints
type RequestedEndpoint = Required<Pick<Endpoint, "id" | "name" | "baseUrl" | "bearerToken">>;
        

export default (elemRoot: JQuery<HTMLElement>) => {
    const updateUI = async () => {
        elemRoot.html("");

        // get data
        const data = await graphql(`
            {
                endpoints {
                    id
                    name
                    baseUrl
                    bearerToken
                }
            }
        `);

        // create containers
        const container = createContainers(elemRoot, "endpoints", "title", "content");

        // do title row
        uiutils.appendTitleRow(container.children!.title.elem, "Endpoints", [
            {
                rel: "create",
                icon: "plus",
                click: function () {
                    new EndpointForm().show();
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: function () {
                    updateUI();
                },
            },
        ]);
        
        const endpoints = data.endpoints as Array<RequestedEndpoint>;
        if (endpoints.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                headers: ["NAME", "BASEURL", "BEARER TOKEN"],
                classes: ["", ""],
                rows: endpoints.map((endpoint) => {
                    return {
                        id: endpoint.id,
                        data: endpoint,
                        columns: [endpoint.name, endpoint.baseUrl, endpoint.bearerToken],
                        click: function () {
                            new EndpointForm(endpoint).show();
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any endpoints defined.");
        }
    };

    // build initial ui
    updateUI();
}
