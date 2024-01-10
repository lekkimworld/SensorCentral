import { Sensor } from "../clientside-types";
import { DateControl, Form, ToggleButtonControl, UICatalog, buttonClose, buttonPerformAction } from "../forms-util";

export type DownloadFormInput = {
    supportsGrouping: boolean;
};

/**
 * Data from the form is returned through the `data` event with the following 
 * fields:
 * startDate (Moment)
 * endDate (Moment)
 * scaleFactor (boolean)
 * grouped (boolean)
 */
export class DownloadForm extends Form<DownloadFormInput> {
    constructor(input: DownloadFormInput) {
        super("download", "Download", input);
    }

    body(catalog: UICatalog): string {
        return `<form id="downloadForm">
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
            ${
                this.doGroupedAndScaled()
                    ? catalog.toggleButton({
                          label: "Grouped",
                          name: "grouped",
                          fieldExplanation: "Deselect if you want to export raw samples",
                          on: true,
                      })
                    : ""
            }
            ${
                this.doGroupedAndScaled()
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
        const start = (catalog.get("startDate") as DateControl).moment;
        const end = (catalog.get("endDate") as DateControl).moment;
        const grouped = this.doGroupedAndScaled() ? (catalog.get("grouped") as ToggleButtonControl).checked : false;
        const scaleFactor =
            this.doGroupedAndScaled() ? (catalog.get("scaleFactor") as ToggleButtonControl).checked : false;
        return {
            start,
            end,
            grouped,
            scaleFactor
        };
    }

    private doGroupedAndScaled() : boolean {
        return this.ctx!.supportsGrouping;
    }
}