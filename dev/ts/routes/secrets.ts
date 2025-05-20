import { Secret } from "../clientside-types";
import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { SecretForm } from "../forms/create-edit-secret";

// create type for endpoints
type RequestedSecret = Required<Pick<Secret, "id" | "name" | "value">>;
        

export default (elemRoot: JQuery<HTMLElement>) => {
    const updateUI = async () => {
        elemRoot.html("");

        // get data
        const data = await graphql(`
            {
                secrets {
                    id
                    name
                    value
                }
            }
        `);

        // create containers
        const container = createContainers(elemRoot, "secrets", "title", "content");

        // do title row
        uiutils.appendTitleRow(container.children!.title.elem, "Secrets", [
            {
                rel: "create",
                icon: "plus",
                click: async function () {
                    new SecretForm().show();
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: async function () {
                    updateUI();
                },
            },
        ]);
        
        const secrets = data.secrets as Array<RequestedSecret>;
        if (secrets.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                headers: ["NAME", "VALUE"],
                classes: ["", ""],
                rows: secrets.map((s) => {
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
    };

    // build initial ui
    updateUI();
}
