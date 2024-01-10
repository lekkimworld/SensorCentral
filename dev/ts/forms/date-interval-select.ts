import { Moment } from "moment";
import { buttonClose, buttonPerformAction, DateControl, DateTimeControl, Form, initDatePicker, initDateTimePicker, UICatalog } from "../forms-util";

export type DateIntervalSelectFormData = {
    start: Date;
    end: Date;
    moment: {
        start: Moment,
        end: Moment
    }
}

export class DateIntervalSelectForm extends Form<DateIntervalSelectFormData> {
    constructor() {
        super("intervalselect", "Interval Selection");
        this.addEventListener("init", () => {
            // init date/time pickers
            initDatePicker({ id: "start_dt" });
            initDatePicker({ id: "end_dt" });
        })
    }
    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
                ${catalog.datepicker({
                    name: "start_dt",
                    label: "Start Date",
                    fieldExplanation: "Specify the start date - the selected date is included.",
                    required: true,
                    validationText: "You must specify the start date"
                })}
                ${catalog.datepicker({
                    name: "end_dt",
                    label: "End Date",
                    fieldExplanation: "Specify the end date - the selected date is included.",
                    required: true,
                    validationText: "You must specify the end date."
                })}
            </form>`
    }
    footer() {
        return `${buttonClose()}
            ${buttonPerformAction("Apply")}`
    }

    async getData(catalog: UICatalog) {
        // build return data
        const sdt = (catalog.get("start_dt") as DateControl).moment;
        const edt = (catalog.get("end_dt") as DateControl).moment.add(1, "day");
        return {
            start: (edt.isAfter(sdt) ? sdt : edt).toDate(),
            end: (edt.isAfter(sdt) ? edt : sdt).toDate(),
            moment: {
                start: edt.isAfter(sdt) ? sdt : edt,
                end: edt.isAfter(sdt) ? edt : sdt
            },
        } as DateIntervalSelectFormData;
    }
}
