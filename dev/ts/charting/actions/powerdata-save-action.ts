import { ChartAction, ChartContainer, PowerDataDownloadOptions } from "../charting";
import { downloadData } from "../utils";

export default abstract class PowerdataSaveAction extends ChartAction {
    constructor() {
        super("SAVE", "save");
    }
    async invoke(container: ChartContainer) {
        // get the options
        const downloadOptions = await this.getDownloadOptions(container.data);
        console.log(`Received download options`, downloadOptions);

        // post the options to serverside to prep the data
        downloadData(downloadOptions);
    }

    protected abstract getDownloadOptions(containerData: any) : PowerDataDownloadOptions;
}

