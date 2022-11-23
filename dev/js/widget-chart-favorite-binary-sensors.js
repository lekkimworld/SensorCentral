const baseWidget = require("./widget-chart-favorite-sensors-base");

module.exports = (elem) => {
    console.log(baseWidget);
    baseWidget(elem, "Favorite Binary Sensors", "binary");
};
