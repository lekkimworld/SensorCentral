import { House } from "../clientside-types";
import { graphql } from "../fetch-util";
import { button, buttonClose, textField, Form, ClickEvent } from "../forms-util";
import * as storage from "../storage-utils";

type User = {
    id: string;
    email: string;
    action: string;
    fn: string;
    ln: string;
}

export class HouseAccessForm extends Form<House> {
    private users : Array<User> = [];
    private emails = new Set<string>();

    constructor(h: House) {
        super("houseaccess", "House Access", h);
        this.addEventListener("init", async () => {
            // reset
            this.users = [];
            this.emails = new Set();

            // get uers
            const data = await graphql(`{house(id: "${this.ctx!.id}"){
            users{id,fn,ln,email}}}`);
            const elem = $("#houseaccessUsers");
            const me = storage.getUser();
            data.house.users
                .filter((u) => u.id !== me.id)
                .forEach((u) => {
                    u.action = "";
                    this._addUser(u);
                });
        })
        this.addEventListener("click", async (e) => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if (rel.indexOf("remove-") === 0) {
                const id = rel.substring(7);
                this.users = this.users.reduce((prev, u) => {
                    if (u.id !== id) {
                        prev.push(u);
                    } else if (u.action === "add") {
                        // was added - remove completely
                    } else {
                        u.action = "remove";
                        prev.push(u);
                    }
                    return prev;
                }, [] as User[]);
                this.emails = new Set(this.users.map((u) => u.email));
                this.users.filter((u) => u.id === id).forEach((u) => (u.action = u.action = "remove"));
                this._rebuildUsers();

            } else if (rel === "add") {
                const elemError = $("#houseaccessError");
                const elem = $("#emailInput");
                const email = (elem!.val()! as string).trim();

                if (!email || !email.trim().length) return;
                if (this.emails.has(email)) {
                    elemError.text(`User with email (${email}) already have access.`);
                    elem.text("");
                    return;
                }

                // load user
                try {
                    const data = await graphql(`{user(email: "${email}"){id,fn,ln,email}}`);
                    data.user.action = "add";
                    this._addUser(data.user);

                    // clear field
                    elem.val("");
                    elemError.text("");
                } catch (err) {
                    elemError.text(`Unable to find user with email (${email})`);
                }
            } else if (rel === "save") {
                const addIds = this.users
                    .filter((u) => u.action === "add")
                    .map((u) => {
                        return `"${u.id}"`;
                    })
                    .join(",");
                const removeIds = this.users
                    .filter((u) => u.action === "remove")
                    .map((u) => {
                        return `"${u.id}"`;
                    })
                    .join(",");
                const data = await graphql(`mutation {
                    addHouseUsers(data: {houseId: "${this.ctx!.id}", ids: [${addIds}]})
                    removeHouseUsers(data: {houseId: "${this.ctx!.id}", ids: [${removeIds}]})
                }`);
                this.hide();
            }
        })
    }
    body() {
        const formname = this.name;
        return `<p>
                Search by email for the user to grant access to the house and click Add to add the 
                user to the list below. To remove a user click the "-" icon next to the name. 
                Existing users are listed in regular font, users you are adding 
                are shown in italics nd users you are removing are shown as strikethough. Click Save to 
                effectuate the changes. You as the owner are not shown.
                </p>
                <div class="color-red" id="${formname}Error"></div>
                ${textField({
                    name: "email", 
                    label: "Email", 
                    fieldExplanation: "Specify the email address of the user to grant access"
                })}
                ${button({
                    text: "Add", 
                    rel: "add"
                })}
                <div class="mt-2" id="${formname}Users"></div>`
            }
    footer() {
        return `
            ${button({
                text: "Save", 
                rel: "save"
            })}
            ${buttonClose("Cancel")}`
    }
    private _addUser(u: User) {
        const elem = $("#houseaccessUsers");
        elem.append(`
        <div class="row mb-1" id="user-${u.id}">
            <div class="col-1">${button({
                text: "-", 
                rel: `remove-${u.id}`, 
                classList: ["btn-danger", "sensorcentral-btn-small"]
            })}</div>
            <div class="col ${u.action === "add" ? "text-italic" : u.action === "remove" ? "text-strikethrough" : ""}">${u.fn} ${u.ln} (${u.email})</div>
        </div>`);
        this.users.push(u);
        this.emails.add(u.email);
    }
    private _rebuildUsers() {
        const elem = $("#houseaccessUsers");
        elem.html("");
        this.users.forEach(u => {
            elem.append(`
            <div class="row mb-1" id="user-${u.id}">
                <div class="col-1">${button({
                    text: "-", 
                    rel: `remove-${u.id}`, 
                    classList: ["btn-danger", "sensorcentral-btn-small"]
                })}</div>
                <div class="col ${u.action === "add" ? "text-italic" : u.action === "remove" ? "text-strikethrough" : ""}">${u.fn} ${u.ln} (${u.email})</div>
            </div>`);
        })
    }
}