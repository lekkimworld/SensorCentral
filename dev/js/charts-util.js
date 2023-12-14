import {Chart} from "chart.js";
import moment from "moment";
import * as uiutils from "./ui-utils";
import * as fetcher from "../ts/fetch-util";
import {DateIntervalSelectForm} from "../ts/forms/date-interval-select";
import {v1 as uuid} from "uuid";
import constants from "./constants";

const ID_CHART_BASE = "sensorChart";
const ID_CHART_CONTAINER = `${ID_CHART_BASE}_container`;
const ID_CHART_ACTIONS = `${ID_CHART_BASE}_actions`;
const ID_CHART_BODY = `${ID_CHART_BASE}_body`;

const MAX_Y_FACTOR = 0.1;

const formatDate = d => {
    const m = d.getMonth();
    const month = m === 0 ? "jan" : m === 1 ? "feb" : m === 2 ? "mar" : m === 3 ? "apr" : m === 4 ? "may" : m === 5 ? "jun" : m === 6 ? "jul" : m === 7 ? "aug" : m === 8 ? "sep" : m === 9 ? "oct" : m === 10 ? "nov" : "dec";
    return `${d.getDate()} ${month}`;
}

const formatTime = d => {
    return `${d.getHours() < 10 ? "0" + d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
}

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
    darkgreen: "rgba(53, 71, 64)"
};
const backgroundColors = Object.values(colorMap);

const charts = {};
const createOrUpdateChart = (id, chartConfig) => {
    let myChart = charts[id];
    if (myChart) {
        myChart.destroy();
        delete charts[id];
    }
    let ctx2d = document.getElementById(id).getContext('2d');
    myChart = new Chart(ctx2d, chartConfig);
    charts[id] = myChart;
}

const createCanvasForContainer = id => {
    const canvasId = `${id}_canvas`;
    $(`#${id}`).html(`<canvas id="${canvasId}" width="${window.innerWidth - 20}px" height="${window.innerHeight < 400 ? 200 : 400}px"></canvas>`)
    return canvasId;
}

const setResponsiveFlag = (options) => {
    if (!options.hasOwnProperty("responsive") || typeof options.responsive !== "boolean") {
        options.responsive = true;
    }
}

export const lineChart = (id, labels, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    setResponsiveFlag(options);

    // get data sets
    if (options.dataset) {
        var datasets = [{
            "label": options.dataset.label,
            "data": options.dataset.data
        }]
    } else if (options.datasets) {
        var datasets = options.datasets;
    }
    datasets.forEach((ds, idx) => {
        if (!ds.backgroundColor) ds.backgroundColor = backgroundColors[idx];
        if (!ds.borderColor) ds.borderColor = backgroundColors[idx];
        ds.pointRadius = 0;
        ds.fill = false;
    })

    const minY = options.min || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e < prev ? e : prev, prev);
    }, 0);
    const maxY = options.max || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e > prev ? e : prev, prev);
    }, 0);

    const chartData = {
        labels,
        datasets
    }
    const chartOptions = {
        "responsive": options.responsive,
        "scales": {
            "xAxes": [{}],
            "yAxes": [{
                "ticks": {
                    "min": minY,
                    "max": Math.ceil(maxY + (maxY * MAX_Y_FACTOR))
                }
            }]
        }
    }
    const chartConfig = {
        "type": "line",
        "data": chartData,
        "options": chartOptions
    };
    createOrUpdateChart(id, chartConfig);
};

export const timeChart = (id, datasets, options = {}) => {
    if (!options.hasOwnProperty("animation")) options.animation = {}
    if (!options.animation.hasOwnProperty("duration")) options.animation.duration = 500;
    setResponsiveFlag(options);

    const cfg = {
        "data": {
            "datasets": datasets.map((ds, idx) => ({
                label: ds.name,
                backgroundColor: backgroundColors[idx % backgroundColors.length],
                borderColor: backgroundColors[idx % backgroundColors.length],
                data: ds.data.map(s => {
                    let result = {
                        x: moment.utc(s.x, "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]").tz(constants.TIMEZONE),
                        y: s.y
                    }
                    return result;
                }),
                type: 'line',
                pointRadius: 0,
                fill: false,
                lineTension: 0,
                borderWidth: 2
            }))
        },
        "options": {
            "responsive": options.responsive,
            "animation": options.animation,
            "scales": {
                "xAxes": [{
                    "type": 'time',
                    "distribution": 'series',
                    "offset": true,
                    "ticks": {
                        major: {
                            enabled: true,
                            fontStyle: 'bold'
                        },
                        source: 'data',
                        autoSkip: true,
                        autoSkipPadding: 75,
                        maxRotation: 0,
                        sampleSize: 100
                    },
                    afterBuildTicks: function (scale, ticks) {
                        var majorUnit = scale._majorUnit;
                        var firstTick = ticks[0];
                        var i, ilen, val, tick, currMajor, lastMajor;

                        val = moment(ticks[0].value);
                        if ((majorUnit === 'minute' && val.second() === 0) ||
                            (majorUnit === 'hour' && val.minute() === 0) ||
                            (majorUnit === 'day' && val.hour() === 9) ||
                            (majorUnit === 'month' && val.date() <= 3 && val.isoWeekday() === 1) ||
                            (majorUnit === 'year' && val.month() === 0)) {
                            firstTick.major = true;
                        } else {
                            firstTick.major = false;
                        }
                        lastMajor = val.get(majorUnit);

                        for (i = 1, ilen = ticks.length; i < ilen; i++) {
                            tick = ticks[i];
                            val = moment(tick.value);
                            currMajor = val.get(majorUnit);
                            tick.major = currMajor !== lastMajor;
                            lastMajor = currMajor;
                        }
                        return ticks;
                    }
                }],
                "yAxes": [{
                    gridLines: {
                        drawBorder: false
                    }
                }]
            }
        }
    };
    createOrUpdateChart(id, cfg);
}

export const barChart = (id, labels, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    setResponsiveFlag(options);

    // create data sets
    if (options.dataset) {
        var datasets = [{
            "label": options.dataset.label,
            "data": options.dataset.data
        }]
    } else if (options.datasets) {
        var datasets = options.datasets;
    }
    datasets.forEach((ds, idx) => {
        if (!ds.backgroundColor) ds.backgroundColor = backgroundColors[idx];
    })

    const minY = options.min || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e < prev ? e : prev, prev);
    }, 0);
    const maxY = options.max || datasets.reduce((prev, ds) => {
        if (options.stacked) {
            const max = ds.data.reduce((prev, e) => e > prev ? e : prev, 0);
            return prev + max;
        } else {
            return ds.data.reduce((prev, e) => e > prev ? e : prev, prev);
        }
    }, 0);

    const chartData = {
        labels,
        datasets
    }
    const chartOptions = {
        "responsive": options.responsive,
        "scales": {
            "xAxes": [{
                "stacked": options.stacked
            }],
            "yAxes": [{
                "ticks": {
                    "min": minY,
                    "max": Math.ceil(maxY + (maxY * MAX_Y_FACTOR))
                },
                "stacked": options.stacked
            }]
        },
    }
    const chartConfig = {
        "type": "bar",
        "data": chartData,
        "options": chartOptions
    };

    const canvasId = createCanvasForContainer(id);
    createOrUpdateChart(canvasId, chartConfig);
};

const buildGaugeChart = (elementId, { deviceId, sensorIds, sensors, samplesCount = 50, start, end }) => {
    return new Promise((resolve, reject) => {
        if (!deviceId && !sensors && !sensorIds) return Promise.reject(Error("Must supply deviceId, sensors or sensorIds"));
        if (sensors) {
            // use the sensors we received
            resolve(sensors);
        } else if (deviceId) {
            fetcher.graphql(`{sensors(data: {deviceId:"${deviceId}"}){id,name, type}}`).then(data => {
                resolve(data.sensors.filter((s) => ["gauge", "binary"].includes(s.type)));
            })
        } else {
            fetcher.graphql(`query {sensors(data: {sensorIds: [${sensorIds.map(s => `"${s}"`).join()}]}){id,name}}`).then(data => {
                resolve(data.sensors);
            })
        }
    }).then(sensors => {
        if (!sensors || !sensors.length) return Promise.reject(Error("No gauge sensors to chart."));
        const sensorIdsStr = sensors.map(s => `"${s.id}"`);
        if (start && end) {
            return fetcher.graphql(
                `{dataUngroupedDateQuery(filter: {sensorIds: [${sensorIdsStr.join()}], start: "${start.toISOString()}", end: "${end.toISOString()}"}, format: {decimals: 2, applyScaleFactor: false}){id, name, data{x,y}}}`
            );
        } else {
            return fetcher.graphql(
                `{dataUngroupedCountQuery(filter: {sensorIds: [${sensorIdsStr.join()}], count: ${samplesCount}}, format: {decimals: 2, applyScaleFactor: false}){id, name, data{x,y}}}`
            );
        }
    }).then(result => {
        const samples = result["dataUngroupedDateQuery"] || result["dataUngroupedCountQuery"];
        return Promise.resolve(samples);
    }).then(samples => {
        if (!samples || !Array.isArray(samples)) return Promise.reject(Error("No data received or samples was not an array of data."));
        if (!samples.length) return Promise.resolve();
        if (samples.length === 1 && samples[0].data.length <= 1) return Promise.reject(Error("Cannot chart as only one sample."));

        // build chart
        const canvasId = createCanvasForContainer(elementId);
        timeChart(
            canvasId,
            samples
        );
        return Promise.resolve(samples);

    }).catch(err => {
        $(`#${elementId}`).html(err.message);
    })
}

export const addChartContainer = (elemRoot, options = {}) => {
    if (!options.hasOwnProperty("actions")) options.actions = [];
    if (!options.hasOwnProperty("title")) options.title = "Chart";
    if (!options.hasOwnProperty("classList")) options.classList = [];
    if (!options.hasOwnProperty("append")) options.append = false;

    // create ids
    const uid = uuid();
    const containerId = `${ID_CHART_CONTAINER}_${uid}`;
    const actionsId = `${ID_CHART_ACTIONS}_${uid}`
    const bodyId = `${ID_CHART_BODY}_${uid}`
    const bodyhtml = `<div id="${containerId}" class="widget-placeholder-item widget-skeleton-loader">
        ${uiutils.htmlSectionTitle(options.title || "", "float-left")}
        <span id="${actionsId}"></span>
        <div id="${bodyId}"></div>
    </div>`;

    // set html
    if (options.append) {
        elemRoot.append(bodyhtml);
    } else {
        elemRoot.html(bodyhtml);
    }

    // remove skeleton method
    const removeSkeleton = () => {
        const e = document.querySelector(`#${containerId}`);
        e.classList.remove("widget-skeleton-loader");
        e.classList.remove("widget-placeholder-item");
    }
    const addSkeleton = (args = {}) => {
        const e = document.querySelector(`#${containerId}`);
        if (args && Object.prototype.hasOwnProperty.call(args, "clearContainer") && typeof args.clearContainer === "boolean" && args.clearContainer === true) {
            document.querySelector(`#${bodyId}`).innerHTML = "";
        }
        e.classList.add("widget-skeleton-loader");
        e.classList.add("widget-placeholder-item");
        const height = window.innerHeight < 400 ? 200 : 400;
        e.style.setProperty("--widget-skeleton-min-height", `${height}px`);
    }

    // create context
    let chartOptions;
    let chartFn;
    const state = {};
    const ctx = {
        "_state": state,
        addSkeleton,
        removeSkeleton,
        "reload": (ctx) => {
            if (!chartFn) return Promise.reject(Error("Not called before"));
            addSkeleton();
            const options = Object.assign({}, chartOptions);
            options.start = ctx.start_dt;
            options.end = ctx.end_dt;
            chartOptions = options;
            return chartFn(bodyId, options).then(data => {
                state.data = data;
                removeSkeleton();
                return Promise.resolve(data);
            })
        },
        "gaugeChart": (options) => {
            chartOptions = options;
            chartFn = buildGaugeChart;
            return buildGaugeChart(bodyId, options).then(data => {
                state.data = data;
                removeSkeleton();
                return Promise.resolve(data);
            })
        },
        "timeChart": (datasets, options) => {
            chartOptions = options;
            chartFn = timeChart;
            removeSkeleton();
            return timeChart(bodyId, datasets, options);
        },
        "barChart": (labels, options) => {
            chartOptions = options;
            chartFn = barChart;
            removeSkeleton();
            return barChart(bodyId, labels, options);
        }
    };

    // filter non compliant actions
    const stdActions = new Map();
    stdActions.set("INTERVAL", {
        "id": "calendar",
        "icon": "fa-calendar",
        "callback": (chartCtx) => {
            new DateIntervalSelectForm().addEventListener("data", async e => {
                const data = e.data;
                await ctx.reload(data);
                if (options.hasOwnProperty("callback") && typeof options.callback === "function") {
                    options.callback("INTERVAL", data);
                }
            }).show();
        }
    })
    stdActions.set("DOWNLOAD", {
        "id": "save",
        "icon": "fa-save",
        "callback": (ctx) => {
            if (chartFn === buildGaugeChart) {
                fetcher.post(`/api/v1/data/ungrouped`, {
                    "options": chartOptions,
                    "type": "csv"
                }).then(obj => {
                    window.open(`/download/ungrouped/${obj.downloadKey}/attachment`, "_new");
                })
            } else {
                formutils.appendError(Error("Can only create download for ungrouped query."));
            }
        }
    })
    const availableStdActions = Array.from(stdActions.keys());

    // remove non-available standard actions or actions mission id, icon or callback
    options.actions = options.actions.filter(action => {
        if (typeof action === "string" && availableStdActions.includes(action)) return true;
        if (typeof action === "object" && action.id && action.icon && typeof action.callback === "function") return true;
        return false;
    }).map(action => {
        if (typeof action === "object") return action;
        return stdActions.get(action);
    })

    // build actions
    const htmlActions = options.actions.reduce((buffer, action) => {
        buffer += `<i id="${uid}_${action.id}" class="btn fa ${action.icon} float-left p-0 ml-2" aria-hidden="true"></i>`;
        return buffer;
    }, "")
    $(`#${actionsId}`).html(htmlActions);
    options.actions.forEach(action => {
        $(`#${uid}_${action.id}`).on("click", () => {
            action.callback(ctx);
        })
    })

    // return context
    return ctx;
}