import { ChartAction, ChartContainer } from "../charting";

export default class RefreshAction extends ChartAction {
    constructor() {
        super("REFRESH", "refresh");
    }

    async invoke(container: ChartContainer) {
        return container.reload();
    }
}