import { DataEvent } from "../../forms-util";
import { DateIntervalSelectForm, DateIntervalSelectFormData } from "../../forms/date-interval-select";
import { ChartAction } from "../charting";

export default class DateIntervalAction extends ChartAction {
    constructor() {
        super("DATE_INTERVAL", "calendar");
    }

    async invoke(container) {
        new DateIntervalSelectForm()
            .addEventListener("data", async (e) => {
                const data = (e as DataEvent).data as DateIntervalSelectFormData;
                container.data.start = data.start;
                container.data.end = data.end;
                container.reload();
            })
            .show();
    }
}