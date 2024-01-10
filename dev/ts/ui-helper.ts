import { Device, House, Sensor } from "./clientside-types";
import * as uiutils from "./ui-utils";
import { ObjectValues } from "./helpers";

/**
 * Type of icons we support for RouteActions.
 */
const ICONS = {
    plus: "plus",
    refresh: "refresh",
    star_empty: "star-o",
    star_filled: "star",
    pencil: "pencil",
    trash: "trash",
    key: "key",
    info: "info",
    download: "download",
    lock: "lock",
    calendar: "calendar",
    save: "save"
};
export const getFontAwesomeIcon = (icon: ActionIcon) : string => {
    const result = ICONS[icon];
    return result;
}
export type ActionIcon =  keyof typeof ICONS;

/**
 * Click handler type for a RouteAction.
 */
export type RouteActionHandler<T> = () => Promise<T>;
/**
 * Visibility handler type for a RouteAction.
 */
export type VisibilityActionHandler = () => boolean;
/**
 * A RouteAction is an action on a page.
 */
export type RouteAction<T> = {
    rel: string;
    icon: ActionIcon | (() => ActionIcon);
    click: RouteActionHandler<T>;
    visible?: VisibilityActionHandler;
};

export type DataSet = {
    id: string;
    name: string | undefined;
    fromCache: boolean;
    data: DataElement[];
};
export type DataElement = {
    x: string;
    y: number;
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
    mainContainer.className = "mt-4";

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
    if ("house" in pageObject) {
        // house found - this is a device
        const d = pageObject as Device;
        elems.push({
            text: "Houses", id: "houses"
        })
        elems.push({ text: d.house!.name!, id: `house/${d.house!.id}` });
        elems.push({text: d.name!});
        
    } else if ("device" in pageObject) {
        // this is a sensor
        const s = pageObject as Sensor;
        elems.push({ text: "Houses", id: "houses" });
        elems.push({text: s.device!.house!.name!, id: `house/${s.device!.house!.id}` });
        elems.push({text: s.device!.name!, id: `house/${s.device!.house!.id}/device/${s.device!.id}` });
        elems.push({text: s.name!});
    } else {
        // this is a house
        elems.push({ text: "Houses", id: "houses" });
        elems.push({ text: pageObject.name! });
    }

    // add breadcrumbs
    container.elem.html(
        uiutils.htmlBreadcrumbs(elems)
    );
}