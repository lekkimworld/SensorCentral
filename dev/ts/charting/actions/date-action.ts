import { DataEvent } from "../../forms-util";
import { DateSelectForm, DateSelectFormData } from "../../forms/date-select";
import { ChartAction, ChartContainer } from "../charting";

export default class DateAction extends ChartAction {
    constructor() {
        super("DATE", "date");
    }

    async invoke(container: ChartContainer) {
        new DateSelectForm()
            .addEventListener("data", async (e) => {
                const data = (e as DataEvent).data as DateSelectFormData;
                container.data.date = data.moment;
                container.reload();
            })
            .show();
    }
}