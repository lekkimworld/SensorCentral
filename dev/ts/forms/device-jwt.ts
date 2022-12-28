import { Device } from "../clientside-types";
import { post } from "../fetch-util";
import { button, buttonClose, ClickEvent, Form, InitEvent, UICatalog } from "../forms-util";

export class DeviceJWTForm extends Form<Device> {
    private jwt: string;

    constructor(device: Device) {
        super("jwt", "Device JWT", device);
        this.addEventListener("click", async e => {
            const ev = e as ClickEvent;
            if ("clipboard" === ev.rel) {
                await navigator.clipboard.writeText(this.jwt);
                $("#copied").removeClass("hidden").addClass("shown");
                setTimeout(() => {
                    $("#copied").addClass("hidden").removeClass("shown");
                }, 2000);
            }
        })
        this.addEventListener("init", async (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            const obj = await post("/api/v1/login/jwt", {
                house: this.ctx!.house!.id,
                device: this.ctx!.id,
            });
            catalog.get("jwt").value = obj.token;
            this.jwt = obj.token;
        })
    }
    body(catalog: UICatalog) {
        return `<form id="jwtForm">
            ${catalog.disabledTextField({
                name: "jwt",
                label: "JWT",
                fieldExplanation: "JSON Web Token for device."
            })}
        </form>
        <div id="copied" class="hidden">
        JWT copied to clipboard.
        </div>`
    }
    footer() {
        return `
            ${button({text: "Copy JWT", rel: "clipboard"})}
            ${buttonClose()}`
    }
}