import { Device, House, Sensor } from "./clientside-types";
import * as uiutils from "../js/ui-utils";
import { ObjectValues } from "./helpers";

/**
 * Type of icons we support for RouteActions.
 */
export const ICONS = {
    plus: "create",
    refresh: "refresh",
    star_empty: "star-o",
    star_filled: "star",
    pencil: "pencil",
    trash: "trash",
    key: "key",
    info: "info",
    download: "download"
} as const;
export type ActionIcon = ObjectValues<typeof ICONS>;

/**
 * Handler type for a RouteAction.
 */
export type RouteActionHandler = () => void;
/**
 * A RouteAction is an action on a page.
 */
export type RouteAction = {
    rel: string;
    icon: string;
    click: RouteActionHandler;
}

/**
 * Elements in the breadcrumb bar at the top of the page.
 */
type BreadcrumbElement = {
    text: string;
    id?: string;
};

export type Container = {
    id: string,
    elem: JQuery<HTMLDivElement>,
    children?: {[key:string]: Container}
}

export const createContainers = (root: JQuery<HTMLElement>, idPrefix: string, ...children: string[]) : Container=> {
    // create root
    const mainContainer = document.createElement("div");
    mainContainer.id = `${idPrefix}-container`;

    // start result
    const result : Container = {
        id: `${idPrefix}-container`,
        elem: $(mainContainer),
    };
    if (children) result.children = {};

    for (let child of children) {
        // build child
        const childContainer = document.createElement("div");
        childContainer.id = `${idPrefix}-${child}`;
        mainContainer.appendChild(childContainer);
        result.children![child] = {
            id: `${idPrefix}-${child}`,
            elem: $(childContainer)
        };
    }

    // append container to supplied root element
    root.append(mainContainer);

    // return
    return result;
};

export const createBreadcrumbHeader = async (pageObject: House|Device|Sensor, container: Container) => {
    const elems : Array<BreadcrumbElement> = [{
        text: "Home", id: "#root"
    }]
    if (!("house" in pageObject)) {
        elems.push({
            text: "Houses", id: "houses"
        })
        elems.push({
            text: (pageObject as Device).name!,
        });
    }
    if ("house" in pageObject) {
        elems.push({
            text: "Houses",
            id: "houses",
        });
        elems.push({
            text: (pageObject as Device).house!.name!,
            id: `house/${(pageObject as Device).house!.id!}`
        });
        elems.push({
            text: (pageObject as Device).name!
        });
    }
    if ("device" in pageObject) {
        const s = pageObject as Sensor;
        elems.push({text: s.device!.house!.name!, id: `house/${s.device!.house!.id}` });
        elems.push({text: s.device!.name!, id: `house/${s.device!.house!.id}/device/${s.device!.id}` });
    }

    // add breadcrumbs
    container.elem.html(
        uiutils.htmlBreadcrumbs(elems)
    );
}