import { post } from "../fetch-util";
import { PowerDataDownloadOptions, SensorDataDownloadOptions } from "./charting";

export const downloadData = async (downloadOptions: SensorDataDownloadOptions | PowerDataDownloadOptions) => {
    // validate
    const isPower = "dates" in downloadOptions;
    let options = {
        type: isPower ? "power" : downloadOptions.type,
        output: downloadOptions.output,
    };
    if (isPower) {
        options = Object.assign(options, {
            dates: downloadOptions.dates.map((m) => m.format("YYYY-MM-DD")),
        });
    } else {
        options = Object.assign(options, {
            start: downloadOptions.start.toISOString(),
            end: downloadOptions.end.toISOString(),
            applyScaleFactor: downloadOptions.applyScaleFactor,
            sensorIds: downloadOptions.sensorIds,
        });
    }
    // post the options to serverside to prep the data
    const obj = await post(`/api/v1/export/${isPower ? "powerprices" : "sensordata"}`, options);

    // create link on page for download
    const a = document.createElement("a");
    a.download = obj.filename;
    a.href = `/download/${obj.filename}/${obj.downloadKey}/attachment`;
    document.querySelector("body")?.appendChild(a);
    a.click();
};
