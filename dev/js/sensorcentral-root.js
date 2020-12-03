const storage = require("./storage-utils");
const { timeChart } = require("./charts-util");
const fetcher = require("./fetch-util");

module.exports = (document, elemRoot) => {
    if (!storage.isLoggedIn()) {
        // user is NOT authenticated
        elemRoot.html(`<h1>Hello stranger!</h1>
        <p>
            Please <a href="javascript:void(0)" id="login">login</a> to use the application.
        </p>`);
        $("#login").on("click", () => {
            storage.login();
            document.location.reload();
        });

        return;
    }

    // user is authenticated
    const user = storage.getUser();
    elemRoot.html(`
        <div class="row">
            <div class="col-lg-6 col-md-12 col-sm-12" 
                id="sensorcentral_powerdata"></div>
            <div class="col-lg-6 col-md-12 col-sm-12" 
                id="sensorcentral_stackeddelta"></div>
        </div>
        <div class="row">
            <div class="col-lg-6 col-md-12 col-sm-12"
                id="sensorcentral_favorites"></div>
            <div class="col-lg-6 col-md-12 col-sm-12"
                id="sensorcentral_favgauges"></div>
        </div>
    `);
    require("./widget-powerdata")($("#sensorcentral_powerdata"));
    require("./widget-stacked-delta-sensors")($("#sensorcentral_stackeddelta"));
    require("./widget-favorite-sensors")($("#sensorcentral_favorites"));
    require("./widget-chart-favorite-gauge-sensors")($("#sensorcentral_favgauges"));
}