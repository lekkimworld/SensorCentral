const uiutils = require("./ui-utils");
const forms = require("./forms-util");
const fetcher = require("./fetch-util");
const uuid = require("uuid").v4;

module.exports = (document, elemRoot, ctx) => {
    const updateUI = () => {
        elemRoot.html("");
    
        // do title row
        uiutils.appendTitleRow(
            elemRoot, 
            "Powermeter Setup", 
            [
                {"rel": "create", "icon": "plus", "click": function() {
                    
                }}, 
                {"rel": "refresh", "icon": "refresh", "click": function() {
                    updateUI(elemRoot, ctx);
                }}
            ]
        );
        fetcher.graphql(`{houses{id,name}}`).then(data => {
            const houseOptions = data.houses.reduce((prev, h) => {
                prev[h.id] = h.name;
                return prev;
            }, {})
            elemRoot.append(`<p>Use this page to configure the connection between SensorCentral 
                and <a href="https://web.smart-me.com" target="_new">smart.me</a> for continuous 
                data from your powermeter. 
                </p>
                <div class="sensorcentral-section">
                    <div class="header">1. Install Kamstrup powermeter module</div>
                    <div class="p-2">
                        <ol>
                        <li>Install a smart.me module in your Kamstrup powermeter</li>
                        <li>Configure the smart.me module using the smartphone app including setting up a username and password</li>
                        <li>Note down the username, password</li>
                        </ol>
                        ${forms.utils.dropdown(
                            "house",
                            "House",
                            "Select the house the powermeter belongs to.",
                            houseOptions,
                            true,
                            true
                        )}
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">2. Specify smart.me account details</div>
                    <div class="p-2">
                        Specify your smart-me username and password below and click "Verify" to verify the 
                        credentials. Upon click "Verify" we will fetch the registered devices from smart-me 
                        together with the current reading in kWh. Pick the device to the house to continue.
                        <form>
                            ${forms.utils.textField("username", "smart.me username", "Specify the smart.me username")}
                            ${forms.utils.textField("password", "smart.me password", "Specify the smart.me password")}
                            <p class="text-center">
                                ${forms.utils.buttonPerformAction("Verify", "verify")}
                            </p>
                        </form>
                        <div id="discover-results" class="mt-3 hidden"></div>
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">3. Create powermeter device and sensor</div>
                    <div class="p-2">
                        The powermeter device is a standard SensorCentral device registration 
                        but the sensor is created with the same ID as the powermeter registered 
                        with smart.me. To make the creation easier click the button below to 
                        ensure a sensor has been created. 
                        <form class="mt-3">
                            ${forms.utils.textField(
                                "powermeter4CreateSensor",
                                "Powermeter ID",
                                "Specify the ID of the powermeter to create sensor for. Only required if you have more than one powermeter on your smart.me account."
                            )}
                            ${forms.utils.toggleButton(
                                "createIfMissing",
                                "Create",
                                "Enable to create a sensor (and device) for the powermeter sensor not found."
                            )}
                            <p class="text-center">
                                ${forms.utils.buttonPerformAction("Check (and create)", "check")}
                            </p>
                        </form>
                        <div id="check-results" class="mt-3 hidden"></div>
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">4. Create subscription</div>
                    <div class="p-2">
                        ${forms.utils.dropdown(
                            "frequency",
                            "Frequency",
                            "Select the frequency in minutes to request powermeter data",
                            {
                                1: "Every 1 minute",
                                2: "Every 2 minutes",
                                5: "Every 5 minutes",
                                10: "Every 10 minutes",
                                15: "Every 15 minutes",
                                30: "Every 30 minutes",
                                60: "Every 60 minutes",
                            },
                            true,
                            true
                        )}
                        <p class="text-center">
                            ${forms.utils.buttonPerformAction("Create realtime subscription!", "create-subscription")}
                        </p>
                        <div id="create-subscription-results" class="mt-3 hidden"></div>
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">5. Remove subscription</div>
                    <div class="p-2">
                        <p class="text-center">
                            ${forms.utils.buttonPerformAction("Remove realtime subscription!", "remove-subscription")}
                        </p>
                        <div id="remove-subscription-results" class="mt-3 hidden"></div>
                    </div>
                </div>

                `);
        })
    }
    updateUI();

    const getSmartmeCredentials = () => {
        const username = $("#usernameInput").val();
        const password = $("#passwordInput").val();
        return {username, password};
    }
    const messageShow = (id, msg, color) => {
        const holder = $(`#${id}`);
        holder.html(`<span style="color: ${color}">${msg}</span>`);
        holder.removeClass("hidden");
    }
    const errorShow = (id, msg) => {
        messageShow(id, msg, "red");
    }
    const errorClear = (id) => {
        const holder = $(`#${id}`);
        holder.addClass("hidden");
        holder.html("");
        return Promise.resolve();
    }

    elemRoot.on("click", ev => {
        if (ev.target.localName !== "button") return;
        const rel = ev.target.getAttribute("rel");
        if (!rel) return;

        if (rel === "verify") {
            const resultsId = "discover-results";

            errorClear(resultsId)
                .then(() => {
                    const creds = getSmartmeCredentials();
                    return fetcher.graphql(
                        `{smartmeGetDevices(data: {username: "${creds.username}", password: "${creds.password}"}){id, name, counterReading, counterReadingUnit}}`
                    );
                })
                .then((validationResult) => {
                    const items = validationResult.smartmeGetDevices.reduce((prev, device) => {
                        prev += `<li id="${device.id}">ID: ${device.id}, name: ${device.name}, current reading: ${device.counterReading}${device.counterReadingUnit}</li>`;
                        return prev;
                    }, "");
                    const holder = $("#discover-results");
                    holder.html(`Discovered powermeters: <ol>${items}</ol>`);
                    holder.removeClass("hidden");
                })
                .catch((err) => {
                    errorShow(resultsId, err.message);
                });
        } else if (rel === "check") {
            const resultsId = "check-results";

            errorClear(resultsId)
                .then(() => {
                    if (!$("#houseInput").val()) {
                        throw Error("Please select a house.");
                    }

                    // get specified id (if any) and ensure it's valid
                    const specifiedId = $("#powermeter4CreateSensorInput").val();
                    if (!specifiedId) throw Error("Please specify the ID of the Powermeter to check for");

                    // look for sensor
                    return fetcher
                        .graphql(`{sensor(id:"${specifiedId}"){id, type, name}}`)
                        .then((sensor) => {
                            // found sensor
                            messageShow(resultsId, "Found SensorCentral sensor - you are all good!", "green");
                        })
                        .catch((err) => {
                            // we do not have the sensor
                            if (!$("#createIfMissingInput").prop("checked")) {
                                // we should not create
                                throw Error("Required sensor not found and you told us not to create it.");
                            }
                            return Promise.resolve(specifiedId);
                        });
                })
                .then((sensorId) => {
                    if (!sensorId) return;

                    // create device and then sensor
                    const houseId = $("#houseInput").val();
                    const deviceId = uuid();
                    return fetcher
                        .graphql(
                            `mutation {createDevice(data: {houseId: "${houseId}", id: "${deviceId}", name: "Kamstrup Powermeter", active: true}){id}}`
                        )
                        .then(() => {
                            return fetcher.graphql(
                                `mutation {createSensor(data: {deviceId: "${deviceId}", id: "${sensorId}", name: "Powermeter", label: "powermeter-${houseId}", type: "counter", icon: "battery-4", scaleFactor: 0.001}){id}}`
                            );
                        })
                        .then(() => {
                            messageShow(resultsId, "Created device and sensor.", "green");
                        });
                })
                .catch((err) => {
                    errorShow(resultsId, err.message);
                });
        } else if (rel === "create-subscription") {
            const frequency = $("#frequencyInput").val();
            const resultsId = "create-subscription-results";
            const sensorId = $("#powermeter4CreateSensorInput").val();
            const houseId = $("#houseInput").val();
            const creds = getSmartmeCredentials();

            errorClear(resultsId)
                .then(() => {
                    // get specified id (if any) and ensure it's valid
                    if (!creds || !creds.username || !creds.password)
                        throw Error("Please ensure the credentials are specified");
                    if (!houseId) throw Error("Please select the house for the Powermeter to subscribe for");
                    if (!sensorId) throw Error("Please specify the ID of the Powermeter to subscribe for");
                    if (!frequency) throw Error("Please specify the frequency for the powermeter query");

                    // really sure
                    if (!confirm("Are you sure?")) throw Error("Aborted");
                })
                .then(() => {
                    return fetcher
                        .graphql(
                            `mutation{smartmeEnsureSubscription(credentials: {username: "${creds.username}", password: "${creds.password}"} subscription: {frequency: ${frequency}, houseId: "${houseId}", sensorId: "${sensorId}"}){house{id,name},sensor{id,name},frequency}}`
                        )
                        .then((data) => {
                            // coming here means we could create the subscription
                            messageShow(resultsId, "Subscription created!", "green");
                        });
                })
                .catch((err) => {
                    errorShow(resultsId, err.message);
                });
        } else if (rel === "remove-subscription") {
            const resultsId = "remove-subscription-results";
            const houseId = $("#houseInput").val();

            errorClear(resultsId)
                .then(() => {
                    // get specified id (if any) and ensure it's valid
                    if (!houseId) throw Error("Please select the house for the Powermeter to subscribe for");
                    
                    // really sure
                    if (!confirm("Are you sure?")) throw Error("Aborted");
                })
                .then(() => {
                    return fetcher
                        .graphql(
                            `mutation{smartmeRemoveSubscription(houseId: "${houseId}")}`
                        )
                        .then((data) => {
                            // coming here means we could remove the subscription
                            messageShow(resultsId, "Subscription removed!", "green");
                        });
                })
                .catch((err) => {
                    errorShow(resultsId, err.message);
                });
        }
    })
}