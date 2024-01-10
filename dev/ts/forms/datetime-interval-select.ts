import { buttonClose, buttonPerformAction, DateTimeControl, Form, initDateTimePicker, UICatalog } from "../forms-util";

export type DateTimeIntervalSelectFormData = {
    start: Date;
    end: Date;
}

export class DateTimeIntervalSelectForm extends Form<DateTimeIntervalSelectFormData> {
    constructor() {
        super("intervalselect", "Interval Selection");
        this.addEventListener("init", () => {
            // init date/time pickers
            initDateTimePicker({ id: "start_dt", inline: true, sideBySide: true });
            initDateTimePicker({ id: "end_dt", inline: true, sideBySide: true });
        })
    }
    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
                ${catalog.datetimepicker({
                    name: "start_dt",
                    label: "Start Date",
                    fieldExplanation: "Specify the start date/time.",
                    required: true,
                    validationText: "You must specify the start date/time."
                })}
                ${catalog.datetimepicker({
                    name: "end_dt",
                    label: "End Date",
                    fieldExplanation: "Specify the end date/time.",
                    required: true,
                    validationText: "You must specify the end date/time."
                })}
            </form>`
    }
    footer() {
        return `${buttonClose()}
            ${buttonPerformAction("Apply")}`
    }

    async getData(catalog: UICatalog) {
        // build return data
        const sdt = (catalog.get("start_dt") as DateTimeControl).moment;
        const edt = (catalog.get("end_dt") as DateTimeControl).moment;
        return {
            start: (edt.isAfter(sdt) ? sdt : edt).toDate(),
            end: (edt.isAfter(sdt) ? edt : sdt).toDate(),
        } as DateTimeIntervalSelectFormData;
    }
}
