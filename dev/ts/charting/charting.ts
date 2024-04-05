import { Legend as LegendType, LegendItem, BarController, BarElement, CategoryScale, Chart, ChartDataset, LineController, LineElement, LinearScale, PointElement, TimeScale } from "chart.js";
import "chartjs-adapter-date-fns";
import { da } from "date-fns/locale";
import moment, { ISO_8601, Moment } from "moment";
import { v4 as uuid } from "uuid";
import constants from "../constants";
import { ActionIcon, DataElement, DataSet, getFontAwesomeIcon } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { Legend } from "chart.js/dist/plugins/plugin.legend";
Chart.register(LegendType, BarController, BarElement, LineController, CategoryScale, TimeScale, LinearScale, PointElement, LineElement );

const ID_CHART_BASE = "sensorChart";
const ID_CHART_CONTAINER = `${ID_CHART_BASE}_container`;
const ID_CHART_ACTIONS = `${ID_CHART_BASE}_actions`;
const ID_CHART_BODY = `${ID_CHART_BASE}_body`;

const colorMap = {
    red: "rgba(255, 99, 132, 0.5)",
    blue: "rgba(54, 162, 235, 0.5)",
    green: "rgba(75, 192, 192, 0.5)",
    grey: "rgb(201, 203, 207)",
    orange: "rgba(255, 159, 64, 0.5)",
    purple: "rgba(153, 102, 255, 0.5)",
    yellow: "rgba(255, 205, 86, 0.5)",
    pink: "rgba(245, 66, 212)",
    black: "rgba(0, 0, 0, 1)",
    darkgreen: "rgba(53, 71, 64)",
};

const getChartDatasetsLabels = (options: ChartContainerOptions, datasets: Array<DataSet>) : Array<string|Date> => {
    if (options.timeseries) {
        return datasets[0].data.map((elem) => {
            const m = moment.utc(elem.x, ISO_8601).tz(constants.TIMEZONE);
            return m.toDate();
        });
    } else {
        return datasets[0].data.map(elem => elem.x);
    }
}
const getChartDatasets = (options: ChartContainerOptions, datasets: Array<DataSet>): Array<ChartDataset> => {
    return datasets.map((ds, idx): ChartDataset => {
        const chartDs = {
            label: ds.name || ds.id,
            borderColor: colorMap[Object.keys(colorMap)[idx]],
            backgroundColor: colorMap[Object.keys(colorMap)[idx]],
            data: ds.data.map((elem) => elem.y),
            pointRadius: 0
        } as ChartDataset;
        if (ds.group) chartDs.stack = ds.group;
        return chartDs;
    });
};
const getChartOptions = (state: ChartState, options: ChartContainerOptions, datasets: Array<DataSet>) => {
    const scales : any = {
        x: {},
        y: {}
    }
    const result : any = {
        responsive: true,
        plugins: {},
        scales
    };
    if (options.type === "stacked-bar") {
        scales.x.stacked = true;
        scales.y.stacked = true;
    }
    if (options.timeseries) {
        scales.x = Object.assign(scales.x, {
            type: "time",
            time: {
                unit: "hour",
                displayFormats: {
                    hour: "dd/MM-yyyy HH:mm",
                },
            },
            adapters: {
                date: {
                    locale: da,
                },
            }
        });
    }
    if (options.adjustMinimumY) {
        scales.y.min = getMinimumDatasetsValue(datasets, options.adjustMinimumY);
    }
    if (options.adjustMaximumY) {
        scales.y.max = getMaximumDatasetsValue(datasets, options.adjustMaximumY);
    }

    // legends
    result.plugins.legend = {
        position: "top",
        display: options.legend || false,
        onClick: (event, legendItem: LegendItem, legend: Legend) => {
            console.log(event);
            console.log(legendItem);
            console.log(legend);
            console.log(datasets);
            
            const datasetIndex = legendItem.datasetIndex!;
            const dataset = state.chart?.getDatasetMeta(datasetIndex)!;
            dataset.hidden = !dataset.hidden
            legend.chart.update();
        }
    };
    result.plugins.title = {
        display: true,
    }
    
    // return
    return result;
}
export const getMinimumDatasetsValue = (datasets: Array<DataSet>, adjust: number = -2) : number => {
    const min = Math.floor(
        datasets.reduce((prev: number, ds: DataSet) => {
            const min = ds.data.reduce((prev: number, elem: DataElement) => {
                return elem.y < prev ? elem.y : prev;
            }, Number.MAX_VALUE);
            return min < prev ? min : prev;
        }, Number.MAX_VALUE)
    )
    return min + adjust;
}
export const getMaximumDatasetsValue = (datasets: Array<DataSet>, adjust: number = 2) : number => {
    const max = Math.ceil(
        datasets.reduce((prev: number, ds: DataSet) => {
            const max = ds.data.reduce((prev: number, elem: DataElement) => {
                return (elem.y > prev) ? elem.y : prev;
            }, Number.MIN_VALUE)
            return max > prev ? max : prev;
        }, Number.MIN_VALUE)
    );
    return max + adjust;
}

/**
 * Base options used to request a download of data as an Excel sheet or a CSV file.
 */
export type BaseDownloadOptions = {
    /**
     * Output format
     */
    output: "excel"
}

/**
 * Options used to request a download of sensor data as an Excel sheet or a CSV file.
 */
export type SensorDataDownloadOptions = BaseDownloadOptions & {
    start: Moment;
    end: Moment;
    type: "grouped" | "ungrouped";

    /**
     * Sensor IDs to get data from unless type is set to "power".
     *
     */
    sensorIds: Array<string>;

    /**
     * Sensors of type delta can have a scale factor applied to the values
     *
     */
    applyScaleFactor?: boolean;
};
/**
 * Options used to request a download of power data as an Excel sheet or a CSV file.
 */
export type PowerDataDownloadOptions = BaseDownloadOptions & {
    dates: Array<Moment>;
    type: "power"
};

/**
 * Base class for actions on a chart.
 * 
 */
export abstract class ChartAction {
    public rel: string;
    public icon: ActionIcon | (() => ActionIcon);

    constructor(rel: string, icon: ActionIcon | (() => ActionIcon)) {
        this.rel = rel;
        this.icon = icon;
    }

    abstract invoke(container: ChartContainer) : Promise<void>;
}

export type ChartContainerOptions = {
    /**
     * Title for the chart.
     */
    title: string;

    /**
     * Chart type
     */
    type: "line" | "bar" | "stacked-bar";

    /**
     * That is the x-axis data - specify true to indicate that this is a timeseries so x-axis
     * is dates and should be formatted accordingly.
     */
    timeseries?: boolean;

    /**
     * What should the adjustent of the minimum y-axis value be. If not specified the chart
     * does its own calculation.
     */
    adjustMinimumY?: number;

    /**
     * What should the adjustment of the maximum y-axis value be. If not specified the chart
     * does its own calculation.
     */
    adjustMaximumY?: number;

    /**
     * Should we replace html in the element - default is to append.
     */
    replaceHtml?: boolean;

    /**
     * Should we show legends.
     */
    legend?: boolean;

    /**
     * Actions to show either custom or standard.
     */
    actions?: Array<ChartAction>;

    /**
     * Called to obtain the datasets to show.
     *
     * @returns
     */
    data: (containerData: Record<string, any>) => Promise<Array<DataSet>>;
};

/**
 * Internal state of the chart container.
 */
type ChartState = {
    uid: string;
    containerId: string;
    actionsId: string;
    bodyId: string;
    datasets?: Array<DataSet>;
    chart?: Chart;
};

/**
 * Return type when creating a chart container. Use the container to interact 
 * with the chart after creation ie. reload data etc.
 * 
 */
export type ChartContainer = {
    /**
     * Called to reload and refresh the chart with current state data.
     * 
     * @returns 
     */
    reload: () => Promise<void>

    /**
     * Container state data.
     */
    data: any;

    /**
     * Container options
     */
    options: ChartContainerOptions;
}

type SkeletonOptions = {
    clearContainer: boolean
}

// remove skeleton method
const removeSkeleton = (state: ChartState) => {
    const e = document.querySelector(`#${state.containerId}`) as Element;
    e.classList.remove("widget-skeleton-loader");
    e.classList.remove("widget-placeholder-item");
};
const addSkeleton = (state: ChartState, args: SkeletonOptions = {clearContainer: false}) => {
    const e = document.querySelector(`#${state.containerId}`) as HTMLElement;
    if (args.clearContainer) {
        document.querySelector(`#${state.bodyId}`)!.innerHTML = "";
    }
    e.classList.add("widget-skeleton-loader");
    e.classList.add("widget-placeholder-item");
    const height = window.innerHeight < 400 ? 200 : 400;
    e.style.setProperty("--widget-skeleton-min-height", `${height}px`);
};

const createCanvasForContainer = (id: string) : string => {
    const canvasId = `${id}_canvas`;
    $(`#${id}`).html(
        `<canvas id="${canvasId}" width="${window.innerWidth - 20}px" height="${
            window.innerHeight < 400 ? 200 : 400
        }px"></canvas>`
    );
    return canvasId;
};

export const addChartContainer = (elemRoot: JQuery<HTMLElement>, options : ChartContainerOptions) : ChartContainer => {
    // create context with id
    const uid = uuid();
    const state: ChartState = {
        uid,
        containerId: `${ID_CHART_CONTAINER}_${uid}`,
        actionsId: `${ID_CHART_ACTIONS}_${uid}`,
        bodyId: `${ID_CHART_BODY}_${uid}`
    };
    const bodyhtml = `<div id="${state.containerId}" class="widget-placeholder-item widget-skeleton-loader">
        ${uiutils.htmlSectionTitle(options.title || "", "float-left")}
        <span id="${state.actionsId}"></span>
        <div id="${state.bodyId}"></div>
    </div>`;
    if (options.replaceHtml) {
        elemRoot.html(bodyhtml);
    } else {
        elemRoot.append(bodyhtml);
    }

    // container state data 
    const containerData : Record<string,any> = {};

    // figure out the chart type
    const chartType = options.type === "stacked-bar" ? "bar" : options.type;
    const reload = async () => {
        // load data
        const datasets = await options.data(containerData);

        if (state.chart) {
            // update chart
            state.chart.data.labels = getChartDatasetsLabels(options, datasets);
            state.chart.data.datasets = getChartDatasets(options, datasets);
            state.chart.options = getChartOptions(state, options, datasets) as any;
            state.chart.update();
        } else {
            // build chart
            const canvasId = createCanvasForContainer(state.bodyId);
            const elemCanvas = document.getElementById(canvasId) as HTMLCanvasElement;
            state.chart = new Chart(elemCanvas, {
                type: chartType,
                data: {
                    labels: getChartDatasetsLabels(options, datasets),
                    datasets: getChartDatasets(options, datasets),
                },
                options: getChartOptions(state, options, datasets) as any,
            });
        }

        // remove skeleon and update state
        removeSkeleton(state);
        state.datasets = datasets;
    };
    const chartContainer: ChartContainer = {
        reload,
        options,
        data: containerData
    };

    // remove non-available standard actions or actions mission id, icon or callback
    if (options.actions) {
        // convert actions to html
        const htmlActions = options.actions.reduce((buffer, action) => {
            const stricon = typeof action.icon === "function" ? action.icon() : action.icon;
            const icon = getFontAwesomeIcon(stricon);
            buffer += `<i rel="${action.rel}" id="${uid}_${action.rel}" class="btn fa fa-${icon} float-left p-0 ml-2" aria-hidden="true"></i>`;
            return buffer;
        }, "");

        // get action bar element
        const elemActions = $(`#${state.actionsId}`);

        // set html
        elemActions.html(htmlActions);

        // add callback
        elemActions.on("click", async (ev) => {
            ev.preventDefault();
            ev.bubbles = false;

            // get target
            const targetRel = ev.target.getAttribute("rel")!;

            // find action
            const action = options.actions!.find((a) => a.rel === targetRel)!;

            // call action and await any response
            action.invoke(chartContainer);
        });
    }

    // load initial data
    reload();

    // return
    return chartContainer;
};
