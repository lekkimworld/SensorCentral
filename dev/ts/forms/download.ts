import { Sensor } from "../clientside-types";
import { DataEvent, DateControl, Form, ToggleButtonControl, UICatalog, buttonClose, buttonPerformAction } from "../forms-util";
import {get} from "../fetch-util";
import { Moment } from "moment";

export class DownloadForm extends Form<Sensor> {
    constructor(sensor: Sensor) {
        super("download", "Download", sensor);
        this.addEventListener("data", async (e) => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            const startDate = (data.startDate as Moment).toISOString();
            const endDate = (data.endDate as Moment).toISOString();
            const blob = await get(
                `/api/v1/excel/${data.grouped ? "grouped" : "ungrouped"}/range/${
                    this.ctx!.id
                }/${startDate}/${endDate}`
            );
            const file = window.URL.createObjectURL(blob);
            window.location.assign(file);
        });
    }

    body(catalog: UICatalog): string {
        return `<form id="downloadForm">
            ${catalog.disabledTextField({
                name: "sensorName",
                label: "Sensor",
                value: this.ctx!.name,
            })}
            ${catalog.datepicker(
                {
                    label: "Start date",
                    required: true,
                    name: "startDate",
                },
                {
                    add: {
                        week: -1,
                    },
                }
            )}
            ${catalog.datepicker({
                label: "End date",
                required: true,
                name: "endDate",
            })}
            ${catalog.toggleButton({
                label: "Grouped",
                name: "grouped",
                fieldExplanation: "Deselect if you want to export raw samples",
                on: true,
            })}
        </form>`;
    }

    footer() {
        return `${buttonClose()}
            ${buttonPerformAction("Download")}`;
    }

    async getData(catalog: UICatalog) {
        const startDate = (catalog.get("startDate") as DateControl).moment;
        const endDate = (catalog.get("endDate") as DateControl).moment;
        const grouped = (catalog.get("grouped") as ToggleButtonControl).checked;
        return {
            startDate,
            endDate,
            grouped
        };
    }
}