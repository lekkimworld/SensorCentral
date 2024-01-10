import { DataEvent } from "../../forms-util";
import { DateTimeIntervalSelectForm, DateTimeIntervalSelectFormData } from "../../forms/datetime-interval-select";
import { ChartAction, ChartContainer } from "../charting";

export default class DateTimeIntervalAction extends ChartAction {
    constructor() {
        super("DATETIME_INTERVAL", "calendar");
    }

    async invoke(container: ChartContainer) {
        new DateTimeIntervalSelectForm()
            .addEventListener("data", async (e) => {
                const data = (e as DataEvent).data as DateTimeIntervalSelectFormData;
                container.data.start = data.start;
                container.data.end = data.end;
                container.reload();
            })
            .show();
    }
}