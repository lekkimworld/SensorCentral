import * as storage from "./storage-utils";
import {SettingsForm} from "./forms/settings";
import { getFontAwesomeIcon, RouteAction } from "./ui-helper";

const ID_ACTION_ITEMS = "action-icons";

export const fillMenus = () => {
    const user = storage.getUser();
    const elemUsername = $("#navbarUsernameDropdown");
    const elemMenuitems = $("#navbarMenuItems");

    let htmlMenu = "";
    let htmlUsername = "";
    if (user) {
        htmlMenu =
            `<li class="nav-item">
            <a class="nav-link" href="/#root">Home</a>
            </li>
            <li class="nav-item">
            <a class="nav-link" href="/#configuration/houses">Houses</a>
            </li>`;
        if (user.houseId) {
            htmlMenu += `<li class="nav-item">
            <a class="nav-link" href="/#configuration/house/${user.houseId}">Devices</a>
            </li>
            `;
        }
        htmlMenu += `<li class="nav-item">
            <a class="nav-link" href="/#powermeter/charts">Powermeter</a>
            </li>
            `;
        htmlUsername = `<a class="nav-link dropdown-toggle" href="javascript:void(0)" id="navbarUsernameLink" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            Username: ${user.email || user.id}
            </a>
            <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarUsernameLink">
                <a class="dropdown-item" href="/#powermeter/config">Powermeter Setup</a>
                <a class="dropdown-item" href="/#endpoints">Endpoints</a>
                <a class="dropdown-item" href="javascript:void(0)" id="settings">Settings</a>
                <a class="dropdown-item" href="javascript:void(0)" id="logout">Logout</a>`;
        user.houses.forEach(house => {
            htmlUsername += `<a class="dropdown-item" href="/#house-${house.id}" id="house" date-id="${house.id}">House: ${house.name}</a>`
        })
        htmlUsername += `</div>`;
    }
    htmlMenu += `<li class="nav-item">
        <a href="/#about" class="nav-link">About</a>
        </li>`;

    // set into dom
    elemMenuitems.html(htmlMenu);
    elemUsername.html(htmlUsername);

    // add logout handler
    if (user) {
        $("#logout").on("click", () => {
            // delete local storage
            storage.logout();

            // ensure menu is hidden
            $('.navbar-collapse').removeClass('show');

            // tell server to log us out
            document.location.hash = "#loggedout";
        })
        $("#settings").on("click", () => {
            $('.navbar-collapse').removeClass('show');
            new SettingsForm().show();
        })
    }

    // ensure responsive menu closes after click (in general)
    $('.navbar-nav>li>a').on('click', function() {
        $('.navbar-collapse').removeClass('show');
    });
}

export const htmlBreadcrumbs = (objs) => {
    return objs.map(o => {
        if (!o.id) return o.text;
        if (o.id.indexOf("#") === 0) return `<a href="${o.id}">${o.text}</a>`;
        return `<a href="#configuration/${o.id}">${o.text}</a>`;
    }).join(" &gt; ");
}

export const htmlTitleRow = (title, actions: Array<RouteAction<any>> | undefined, tag = "h3") => {
    const htmlTitle = htmlPageTitle(title, tag);
    const htmlActions = htmlActionBar(actions);
    const html = `<div class="row">
        ${htmlTitle}
        ${htmlActions}
    </div>`
    return html;
}

export const htmlSectionTitle = (title, classList?) => {
    return `<h5 class="${classList ? classList : ""}">${title}</h5>`;
}

export const htmlPageTitle = (title, tag = "h3") => {
    const html = `<div class="col-lg-8 col-md-8 col-sm-12">
        <${tag}>${title}</${tag}>
    </div>`;
    return html;
}

export const htmlActionBar = (actions: Array<RouteAction<any|void>> | undefined) => {
    if (!actions || !actions.length) return "";
    const html = actions.map(action => {
        const iconkey = typeof action.icon === "function" ? action.icon() : action.icon;
        const faicon = getFontAwesomeIcon(iconkey);
        return `<button type="button" class="btn fa fa-${faicon} ml-2 p-0 sensorcentral-size-1_5x float-right" aria-hidden="true" rel="${action.rel}"></button>`
    }).join("");

    return `<div class="col-lg-4 col-md-4 col-sm-12" id="${ID_ACTION_ITEMS}">${html}</div>`;
}

export const htmlDataTable = (input : any = {}) => {
        const ctx : any = Object.assign({}, input);
        if (!ctx.hasOwnProperty("headers")) ctx.headers = [];
        if (!ctx.hasOwnProperty("rows")) ctx.rows = [];
        if (!ctx.hasOwnProperty("actions")) ctx.actions = undefined;
        if (!ctx.hasOwnProperty("classes")) ctx.classes = [];
        const html = `<table class="table table-bordered table-hover" ${input.id ? `id="${input.id}"` : ""}>
    <thead>
        <tr>
            ${ctx.actions ? `<th scope="col" class="d-none d-lg-table-cell"></th>` : ""}${ctx.headers.map((h, idx) => `<th scope="col" class="${ctx.classes[idx]}">${h}</th>`).join("")}
        </tr>
    </thead>
    <tbody>
        ${ctx.rows.map(r => `<tr id="${r.id}">${ctx.actions ? `<td class="d-none d-lg-table-cell"><center>${ctx.actions.filter(a => typeof a.visible === "function" ? a.visible(r) : true).filter(a => a.icon).map(a => `<button class="btn fa fa-${typeof a.icon === "function" ? a.icon(r.data) : a.icon} sensorcentral-size-1_5x" aria-hidden="true" rel="${a.rel}"></button>`).join("")}</center></td>` : ""}${r.columns.map((d, idx) => idx===0 ? `<td class="${ctx.classes[idx]}">${d}</td>` : `<td class="${ctx.classes[idx]}">${d}</td>`).join("")}</tr>`).join("")}
    </tbody>
</table>`;
    return html;
}

export const appendTitleRow = (elem, title, actions : Array<RouteAction<any|void>> = [], args?) => {
    const html = htmlTitleRow(title, actions, args && args.tag ? args.tag : "h3");
    elem.append(html);

    // add click handler
    if (!actions || !actions.length) return;
    $(`#${args && args.actionItemsId ? args.actionItemsId  : ID_ACTION_ITEMS}`).on("click", (ev) => {
        const rel = ev.target.getAttribute("rel");
        const filteredActions = actions.filter((action: any) => action.rel === rel);
        if (!filteredActions.length) return;
        const action : any = filteredActions[0];
        if (action.hasOwnProperty("click") && typeof action.click === "function") {
            action.click.call(ev.target, action);
        }
    });
}

export const appendSectionTitle = (elem, title) => {
    elem.append(htmlSectionTitle(title));
}

export const appendDataTable = (elem, input : any = {}) => {
    // append html table to page
    const html = htmlDataTable(input);
    elem.append(html);

    // add click handler
    $("tbody").on("click", ev => {
        let elem : HTMLElement | null = ev.target.parentElement as HTMLElement;
        let id = elem.id;
        while (!id) {
            elem = elem!.parentElement;
            id = elem!.id;
        }

        // get data object for row
        const filteredRows = input.rows.filter(r => r.id === id);
        let row;
        if (filteredRows && filteredRows.length) {
            row = filteredRows[0];
        }
        if (!row) return;
        
        if (input.actions && ev.target.nodeName === "BUTTON") {
            // get rel and find action
            const rel = ev.target.getAttribute("rel");
            
            const filteredActions = input.actions.filter(a => a.rel === rel);
            if (!filteredActions || !filteredActions.length) return;
            const action = filteredActions[0];
            
            // invoke if there is a click handler
            if (action.hasOwnProperty("click") && typeof action.click === "function") {
                const filteredRows = input.rows.filter(r => r.id === id);
                action.click.call(ev.target, {"id": id, "data": row.data, "action": action});
            }
        } else {
            // click on row - see if there is a row click handler
            if (row.hasOwnProperty("click") && typeof row.click === "function") {
                row.click.call(row);
            }
        }
    })
}
