import { buttonClose, buttonPerformAction, DateTimeControl, Form, UICatalog } from "../forms-util";

export class DateSelectForm extends Form<undefined> {
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

    async getData(catalog: UICatalog) {
        const date = (catalog.get("dt") as DateTimeControl).date;
        return {
            date
        }
    }
}