import * as dateutils from "../date-utils";
import { Device } from "../clientside-types";
import { graphql } from "../fetch-util";
import { Form, UICatalog, InitEvent } from "../forms-util";

export class DeviceData extends Form<Device> {

    constructor(device: Device) {
        super("devicename", "Device Data", device);
        this.addEventListener("init", async (ev: Event) => {
            const data = (await graphql(`{deviceData(id:"${this.ctx!.id}"){id,dt,ip}}`)) as {
                deviceData: { ip: string; dt: string };
            };
            const catalog = (ev as InitEvent).catalog;
            catalog.get("ip").value = data.deviceData.ip;
            catalog.get("dt").value = dateutils.formatDMYTime(data.deviceData.dt);
        })
    }

    body(catalog: UICatalog): string {
        return `${catalog.disabledTextField({
                        name: "dt", 
                        label: "Date/time", 
                        fieldExplanation: "Last ping date/time of the device."
                    })}
                    ${catalog.disabledTextField({
                        name: "ip", 
                        label: "IP", 
                        fieldExplanation: "Last known IP of the device."
                    })}`
    }
}