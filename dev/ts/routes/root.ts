import * as storage from "../storage-utils";
import favoriteSensorWidget from "../widgets/favorite-sensors";
import powerdataWidget from "../widgets/powerdata";
import stackedDeltaSensorsWidget from "../widgets/stacked-delta-sensors";
import favBinarySensorsWidget from "../widgets/chart-favorite-binary-sensors";
import favGaugeSensorsWidget from "../widgets/chart-favorite-gauge-sensors";

export default (elemRoot: JQuery<HTMLElement>) => {
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
            <div class="col-lg-6 col-md-12 col-sm-12">
                <!-- <div class="w-100" id="sensorcentral_powerdata"></div> -->
                <div class="w-100" id="sensorcentral_favorites"></div>
            </div>
            <div class="col-lg-6 col-md-12 col-sm-12">
                <div class="w-100" id="sensorcentral_stackeddelta"></div>
                <div class="w-100" id="sensorcentral_favgauges"></div>
                <div class="w-100" id="sensorcentral_favbinary"></div>
            </div>
        </div>
    `);
    favoriteSensorWidget($("#sensorcentral_favorites"));
    stackedDeltaSensorsWidget($("#sensorcentral_stackeddelta"));
    //powerdataWidget($("#sensorcentral_powerdata"));
    favBinarySensorsWidget($("#sensorcentral_favbinary"));
    favGaugeSensorsWidget($("#sensorcentral_favgauges"));
}