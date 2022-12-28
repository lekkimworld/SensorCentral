import * as  uiutils from "../../js/ui-utils";
import {HouseForm} from "../forms/create-edit-house";
import {graphql} from "../fetch-util";
import { House, HouseUser } from "../clientside-types";
import { createContainers } from "../ui-helper";

export default (elemRoot: JQuery<HTMLElement>) => {
    const updateUI = async () => {
        elemRoot.html("");

        // create type for loaded houses and sort them
        type RequestedHouse = Required<Pick<House, "id"|"name"|"favorite"|"owner">> & {"users": Array<Required<Pick<HouseUser, "id">>>};
        const data = await graphql(`{houses{id,name,favorite,owner,users{id}}}`);
        const houses = (data.houses as RequestedHouse[]).sort((a, b) => a.name.localeCompare(b.name));

        // create containers
        const container = createContainers(elemRoot, "houses", "title", "content");

        // do title row
        uiutils.appendTitleRow(container.children!.title.elem, "Houses", [
            {
                rel: "create",
                icon: "plus",
                click: function () {
                    new HouseForm().show();
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

        if (houses.length) {
            uiutils.appendDataTable(container.children!.content.elem, {
                headers: ["NAME", "ID"],
                classes: ["", "d-none d-sm-table-cell"],
                rows: houses.map((house) => {
                    return {
                        id: house.id,
                        data: house,
                        columns: [house.name, house.id],
                        click: function () {
                            document.location.hash = `configuration/house/${this.id}`;
                        },
                    };
                }),
            });
        } else {
            container.children!.content.elem.append("You do not have any houses or access to any houses.");
        }
    };

    // build initial ui
    updateUI();
};