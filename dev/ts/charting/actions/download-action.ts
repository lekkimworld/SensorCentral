import { Moment } from "moment";
import { DataEvent } from "../../forms-util";
import { DownloadForm, DownloadFormInput } from "../../forms/download";
import { ChartAction, ChartContainer, SensorDataDownloadOptions } from "../charting";
import { downloadData } from "../utils";

export default class DownloadAction extends ChartAction {
    constructor() {
        super("DOWNLOAD", "download");
    }

    async invoke(container: ChartContainer) {
        const input = {
            supportsGrouping: false,
        } as DownloadFormInput;
        new DownloadForm(input)
            .addEventListener("data", async (e) => {
                // get data from event
                const data = (e as DataEvent).data;
                const start = data.start as Moment;
                const end = data.end as Moment;
                const sensorIds = data.sensorIds as Array<string>;

                // create excel options
                const options = {
                    start,
                    end,
                    sensorIds,
                    output: "excel",
                    type: "grouped",
                    applyScaleFactor: data.scaleFactor,
                } as SensorDataDownloadOptions;

                // post the (options to serverside to prep the data
                downloadData(options);
            })
            .show();
    }
}