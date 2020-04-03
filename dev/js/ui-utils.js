const $ = require("jquery");
const storage = require("./storage-utils.js");
const log = require("./logger.js");

const fillMenus = () => {
    const user = storage.getUser();
    const elemUsername = $("#navbarUsernameDropdown");
    const elemMenuitems = $("#navbarMenuItems");
    
    if (user) {
        elemMenuitems.html(`<li class="nav-item {{home_active}}">
            <a class="nav-link" href="/#root">Home</a>
            </li>
            <li class="nav-item {{config_active}}">
            <a class="nav-link" href="/#houses">Houses</a>
            </li>
            <li class="nav-item {{dash_active}}">
            <a class="nav-link" href="/#dashboard">Dashboard</a>
            </li>
            <li class="nav-item {{about_active}}">
            <a href="/#about" class="nav-link">About</a>
            </li>`
        );

        elemUsername.html(`<a class="nav-link dropdown-toggle" href="javascript:void(0)" id="navbarUsernameLink" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            Username: ${user.email}
            </a>
            <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarUsernameLink">
                <a class="dropdown-item" href="javascript:void(0)" id="logout">Logout</a>
            </div>`
        );
        $("#logout").on("click", () => {
            storage.logout();
            document.location.reload();
        })

        // ensure responsive menu closes after click
        $('.navbar-nav>li>a').on('click', function(){
            $('.navbar-collapse').removeClass('show');
        });
    } else {
        elemMenuitems.html("");
        elemUsername.html("");
    }
}

const htmlTitleRow = (title, ...actions) => {
    const htmlTitle = htmlPageTitle(title);
    const htmlActions = htmlActionBar(actions);
    const html = `<div class="row">
        ${htmlTitle}
        ${htmlActions}
    </div>`
    return html;
}

const htmlPageTitle = (title) => {
    const html = `<div class="col-10">
        <h3>${title}</h3>
    </div>`;
    return html;
}

const htmlActionBar = ([...actions]) => {
    const html = actions.map(action => {
        return `<i class="fa fa-${action.icon} fa-2x mr-2" aria-hidden="true" rel="${action.rel}"></i>`
    }).join("");
    return `<div class="col-2" id="action-icons">${html}</div>`;
}

const htmlDataTable = (input = {}) => {
    const ctx = Object.assign({}, input);
    if (!ctx.hasOwnProperty("headers")) ctx.headers = [];
    if (!ctx.hasOwnProperty("rows")) ctx.rows = [];
    if (!ctx.hasOwnProperty("actions")) ctx.actions = undefined;
    const html = `<table class="table table-bordered table-hover">
    <thead>
        <tr>
            ${ctx.actions ? `<th scope="col"></th>` : ""}${ctx.headers.map(h => `<th scope="col">${h}</th>`).join("")}
        </tr>
    </thead>
    <tbody>
        ${ctx.rows.map(r => `<tr id="${r.id}">${ctx.actions ? `<td><center>${ctx.actions.map(a => `<i class="btn fa fa-${a.icon}" aria-hidden="true" rel="${a.rel}"></i>`).join("")}</center></td>` : ""}${r.data.map((d, idx) => idx===0 ? `<th scope="row">${d}</th>` : `<td>${d}</td>`).join("")}</tr>`).join("")}
    </tbody>
</table>`;
    return html;
}

const appendDataTable = (elem, input = {}) => {
    // append html table to page
    const html = htmlDataTable(input);
    elem.append(html);

    // add click handler
    $("tbody").on("click", ev => {
        let elem = ev.target.parentElement;
        let id = elem.id;
        while (!id) {
            elem = elem.parentElement;
            id = elem.id;
        }
        
        if (input.actions && ev.target.nodeName === "I") {
            // get rel and find action
            const rel = ev.target.getAttribute("rel");
            const filteredActions = input.actions.filter(a => a.rel === rel);
            if (!filteredActions || !filteredActions.length) return;
            const action = filteredActions[0];
            
            // invoke if there is a click handler
            if (action.hasOwnProperty("click") && typeof action.click === "function") {
                action.click.call(ev.target, {"id": id, "action": action});
            }
        } else {
            // click on row - see if there is a row click handler
            const filteredRows = input.rows.filter(r => r.id === id);
            if (filteredRows && filteredRows.length) {
                const row = filteredRows[0];
                if (row.hasOwnProperty("click") && typeof row.click === "function") {
                    row.click.call(row);
                }
            }
        }
    })
}

module.exports = {
    htmlTitleRow,
    htmlPageTitle,
    htmlActionBar,
    htmlDataTable,
    appendDataTable,
    fillMenus
}
