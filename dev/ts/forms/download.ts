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
            const scaleFactor = data.scaleFactor as boolean;
            if (data.grouped) {
                var url = `/api/v1/excel/grouped/range/${this.ctx!.id}/${startDate}/${endDate}/${scaleFactor}`;
            } else {
                var url = `/api/v1/excel/ungrouped/range/${
                    this.ctx!.id
                }/${startDate}/${endDate}`;
            }
            const blob = await get(url);
            const file = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = `${this.ctx!.id}_${startDate.replace(/:/g, "")}_${endDate.replace(/:/g, "")}.xlsx`;
            a.href = file;
            document.querySelector("body")?.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(file);
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
            ${this.ctx!.type === "delta" ? catalog.toggleButton({
                label: "Grouped",
                name: "grouped",
                fieldExplanation: "Deselect if you want to export raw samples",
                on: true,
            }) : ""}
            ${
                this.ctx!.type === "delta"
                    ? catalog.toggleButton({
                          label: "Apply scale factor",
                          name: "scaleFactor",
                          fieldExplanation: "Deselect if you want to export raw samples",
                          on: true,
                      })
                    : ""
            }
        </form>`;
    }

    footer() {
        return `${buttonClose()}
            ${buttonPerformAction("Download")}`;
    }

    async getData(catalog: UICatalog) {
        const startDate = (catalog.get("startDate") as DateControl).moment;
        const endDate = (catalog.get("endDate") as DateControl).moment;
        const grouped = this.ctx!.type === "delta" ? (catalog.get("grouped") as ToggleButtonControl).checked : false;
        const scaleFactor =
            this.ctx!.type === "delta" ? (catalog.get("scaleFactor") as ToggleButtonControl).checked : false;
        return {
            startDate,
            endDate,
            grouped,
            scaleFactor
        };
    }
}