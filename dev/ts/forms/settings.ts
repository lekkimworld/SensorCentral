import { get, graphql } from "../fetch-util";
import { button, buttonClose, buttonPerformAction, ClickEvent, DataEvent, Form, InitEvent, UICatalog } from "../forms-util";
import * as storage from "../storage-utils";

export class SettingsForm extends Form<undefined> {
    constructor() {
        super("setting", "Settings");
        this.addEventListener("data", async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            await graphql(
                `mutation{updateSettings(data: {pushover_userkey: "${data.pushover_userkey}", pushover_apptoken: "${data.pushover_apptoken}"})}`
            );
        })
        this.addEventListener("init", async (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            const data = (await graphql(
                `
                    {
                        settings {
                            pushover_userkey
                            pushover_apptoken
                        }
                    }
                `
            )) as { settings: { pushover_userkey: string; pushover_apptoken: string } };
            catalog.get("pushoverApptoken").value = data.settings.pushover_apptoken;
            catalog.get("pushoverUserkey").value = data.settings.pushover_userkey;
            catalog.get("yourJWT").value = storage.getJWT() || "";
        })
        this.addEventListener("click", async e => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if ("clipboard" === rel) {
                await navigator.clipboard.writeText(storage.getJWT() || "");
                $("#copied").addClass("shown").removeClass("hidden");
                setTimeout(() => {
                    $("#copied").removeClass("shown").addClass("hidden");
                }, 2000);
            } else if (rel.startsWith("oidc_")) {
                const provider = rel.substring(5);
                const data = await get(`/api/v1/login/${provider}`);
                document.location.href = data.url
            }
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
                    ${catalog.textField({
                        name: "pushoverApptoken",
                        label: "Pushover App Token",
                        fieldExplanation: "Specify the Pushover App Token",
                    })}
                    ${catalog.textField({
                        name: "pushoverUserkey",
                        label: "Pushover User Key",
                        fieldExplanation: "Specify the Pushover App Token",
                    })}
                    ${catalog.disabledTextField({
                        name: "yourJWT",
                        label: "Your JWT",
                        fieldExplanation:
                            "This is the JWT used to authorize your access. You may use this for API access if required.",
                    })}
                    <h3 class="font-small">OpenID Connect Login Providers</h3>
                    <p>
                        This section allows you to add additional login providers to your account. Adding 
                        an existing login provider again will fail.
                    </p>
                    <div id="oidcProviders"></div>
                    <ul>
                    <li>${button({
                        text: "Add Login with Github",
                        rel: "oidc_github",
                        classList: ["btn", "btn-warning", "mb-1"],
                    })}</li>
                    <li>${button({
                        text: "Add Login with Google",
                        rel: "oidc_google",
                        classList: ["btn", "btn-warning", "mb-1"],
                    })}</li>
                    <li>${button({
                        text: "Add Login with Microsoft",
                        rel: "oidc_microsoft",
                        classList: ["btn", "btn-warning", "mb-1"],
                    })}</li>
                    </ul>
                    <div id="copied" class="hidden">
                        JWT copied to clipboard.
                    </div>
                </form>`;
    }

    footer() {
        return `${button({
            text: "Copy JWT",
            rel: "clipboard",
        })}
                ${buttonClose()}
                ${buttonPerformAction()}`;
    }

    
    async getData(catalog: UICatalog): Promise<Record<string, string>> {
        return {
            pushover_apptoken: catalog.value("pushoverApptoken"),
            pushover_userkey: catalog.value("pushoverUserkey"),
        };
    }
    
}