import { Moment } from "moment";
import { buttonClose, buttonPerformAction, DateTimeControl, Form, UICatalog } from "../forms-util";

export type DateSelectFormData = {
    date: Date;
    moment: Moment;
};

export class DateSelectForm extends Form<DateSelectFormData> {
    constructor() {
        super("dateselect", "Date Select");
    }

    body(catalog: UICatalog) {
        return `<form id="dateselectForm" novalidate>
            ${catalog.datepicker({
                name: "dt",
                label: "Date",
                fieldExplanation: "Specify the date.",
                required: true,
                validationText: "You must specify the date.",
            })}
            </form>`;
    }

    footer() {
        return `${buttonClose()}
            ${buttonPerformAction("Apply")}`;
    }

    async getData(catalog: UICatalog) : Promise<DateSelectFormData> {
        const ctl = catalog.get("dt") as DateTimeControl;
        return {
            moment: ctl.moment,
            date: ctl.date,
        } as DateSelectFormData;
    }
}