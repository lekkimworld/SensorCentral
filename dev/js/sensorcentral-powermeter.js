const uiutils = require("./ui-utils");
const forms = require("./forms-util");
const fetcher = require("./fetch-util");
const uuid = require("uuid/v4");

module.exports = (document, elemRoot, ctx) => {
    const updateUI = () => {
        elemRoot.html("");
    
        // do title row
        uiutils.appendTitleRow(
            elemRoot, 
            "Powermeter", 
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
                        ${forms.utils.dropdown("house", "House", "Select the house the powermeter belongs to.", houseOptions, true, true)}
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">2. Specify smart.me account details</div>
                    <div class="p-2">
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
                            ${forms.utils.textField("powermeter4CreateSensor", "Powermeter ID", "Specify the ID of the powermeter to create sensor for. Only required if you have more than one powermeter on your smart.me account.")}
                            ${forms.utils.toggleButton("createIfMissing", "Create", "Enable to create a sensor (and device) for the powermeter sensor not found.")}
                            <p class="text-center">
                                ${forms.utils.buttonPerformAction("Check (and create)", "check")}
                            </p>
                        </form>
                        <div id="check-results" class="mt-3 hidden"></div>
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">4. List subscriptions for realtime powermeter data</div>
                    <div class="p-2">
                        <p>
                            This will list the subscriptions that are active for powermeter data from 
                            smart.me. If you see any subscriptions pointing towards SensorCentral 
                            (https://sensorcentral.heisterberg.dk) please contact support and do 
                            NOT proceed.
                        </p>
                        <p class="text-center">
                            ${forms.utils.buttonPerformAction("List subscriptions", "list")}
                        </p>
                        <div id="list-results" class="mt-3 hidden"></div>
                    </div>
                </div>
                <div class="sensorcentral-section mt-3">
                    <div class="header">5. Create subscription for realtime powermeter data</div>
                    <div class="p-2">
                        ${forms.utils.textField("powermeter4CreateSubscription", "Powermeter ID", "Specify the ID of the powermeter for subscription creation. Only required if you have more than one powermeter on your smart.me account.")}
                        <p class="text-center">
                            ${forms.utils.buttonPerformAction("Create realtime subscription!", "create-subscription")}
                        </p>
                        <div id="create-subscription-results" class="mt-3 hidden"></div>
                    </div>
                </div>

                `)
        })
    }
    updateUI();

    const smartmeOperation = (endpoint, body) => {
        const username = $("#usernameInput").val();
        const password = $("#passwordInput").val();
        const opts = {
            "method": body ? "POST" : "GET",
            "headers": {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Basic ${btoa(`${username}:${password}`)}`
            },
            "body": body ? JSON.stringify(body) : undefined
        }
        return fetch(`https://api.smart-me.com/api${endpoint}`, opts).then(res => {
            if (res.status === 401) return Promise.reject(Error("Unauthorized - please verify the specified credentials"));
            if (res.status < 200 || res.status > 299) return Promise.reject(Error(`Received a HTTP code ${res.status} which we clearly did not expect...`));
            return res.json();
        })
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
    const ensurePowermeterIdMatchesSpecified = (specifiedId) => {
        return smartmeOperation("/Devices").then(devices => {
            if (!devices.length) {
                return Promise.reject(Error("There are no devices associated with your smart.me account."));
            } else if (devices.length !== 1 || specifiedId) {
                // more than one powermeter or user specified - ensure 
                // we know what powermeter to work with
                const filtered = devices.filter(device => device.Id === specifiedId);
                if (!filtered.length) return Promise.reject(new Error("Unable to find powermeter with specified ID or you had more than one powermeter and didn't specify a powermeter ID."));
                return Promise.resolve(filtered[0].Id);
            } else {
                return Promise.resolve(devices[0].Id);
            }
        })
    }

    elemRoot.on("click", ev => {
        if (ev.target.localName !== "button") return;
        const rel = ev.target.getAttribute("rel");
        if (!rel) return;

        if (rel === "verify") {
            const resultsId = "discover-results";

            errorClear(resultsId).then(() => {
                return smartmeOperation("/Devices");
            }).then(devices => {
                const items = devices.reduce((prev, device) => {
                    prev += `<li>ID: ${device.Id}, current reading: ${device.CounterReadingImport}</li>`
                    return prev;
                }, "")
                const holder = $("#discover-results");
                holder.html(`Discovered powermeters: <ol>${items}</ol>`);
                holder.removeClass("hidden");

            }).catch(err => {
                errorShow(resultsId, err.message);
            })

        } else if (rel === "check") {
            const resultsId = "check-results";
            
            errorClear(resultsId).then(() => {
                if (!$("#houseInput").val()) {
                    throw Error("Please select a house.");
                }

                // get specified id (if any) and ensure it's valid
                const specifiedId = $("#powermeter4CreateSensorInput").val();
                return ensurePowermeterIdMatchesSpecified(specifiedId);
                
            }).then(sensorId => {
                return fetcher.graphql(`{sensor(id:"${sensorId}"){id, type, name}}`).then(sensor => {
                    // found sensor
                    messageShow(resultsId, "Found SensorCentral sensor - you are all good!", "green");

                }).catch(err => {
                    // we do not have the sensor
                    if (!$("#createIfMissingInput").prop("checked")) {
                        // we should not create
                        throw Error("Required sensor not found and you told us not to create it.");
                    }
                    return Promise.resolve(sensorId);
                })

            }).then(sensorId => {
                if (!sensorId) return;

                // create device and then sensor
                const houseId = $("#houseInput").val();
                const deviceId = uuid();
                return fetcher.graphql(`mutation {createDevice(data: {houseId: "${houseId}", id: "${deviceId}", name: "Kamstrup Powermeter", active: true}){id}}`).then(() => {
                    return fetcher.graphql(`mutation {createSensor(data: {deviceId: "${deviceId}", id: "${sensorId}", name: "Powermeter (${houseId})", label: "powermeter-${houseId}", type: "counter", icon: "battery-4"}){id}}`);
                }).then(() => {
                    messageShow(resultsId, "Created device and sensor.", "green");
                })

            }).catch(err => {
                errorShow(resultsId, err.message);
            })

        } else if (rel === "list") {
            const resultsId = "list-results";
            
            errorClear(resultsId).then(() => {
                return smartmeOperation("/RegisterForRealtimeApi");
            }).then(realtimes => {
                if (realtimes.length) {
                    const items = realtimes.map(r => `<li>${JSON.stringify(r)}</li>`);
                    errorShow(resultsId, `Discovered realtime subscriptions: <ol>${items}</ol>`);
                } else {
                    messageShow(resultsId, "Discovered NO realtime subscriptions.", "green");
                }
            })
        } else if (rel === "create-subscription") {
            const resultsId = "create-subscription-results";

            if (!confirm("Are you sure?")) return;

            errorClear(resultsId).then(() => {
                // get specified id (if any) and ensure it's valid
                const specifiedId = $("#powermeter4CreateSubscriptionInput").val();
                return ensurePowermeterIdMatchesSpecified(specifiedId);
                
            }).then(powermeterId => {
                // generate clientId, username and password for smart.me
                const clientId = uuid();
                const username = uuid();
                const password = uuid();    

                // ensure sensor exists in sensorcentral
                return fetcher.graphql(`{sensor(id: "${powermeterId}"){id,name}}`).then(payload => {
                    // coming here means we have the sensor so all's good - now 
                    // store subscription in sensorcentral
                    return fetcher.graphql(`mutation {createSmartmeSubscription(data: {sensorId: "${powermeterId}", clientId: "${clientId}", username: "${username}", password: "${password}"}){url}}`);

                }).then(data => {
                    // get callback url
                    const url = data.createSmartmeSubscription.url;
                    
                    // create subscription in smart.me
                    return smartmeOperation("/RegisterForRealtimeApi", {
                        "ApiUrl": url,
                        "BasicAuthUsername": username,
                        "BasicAuthPassword": password,
                        "MeterId": powermeterId,
                        "RegistrationType": "SingleMeterRegistration"
                    })

                }).then(() => {
                    messageShow(resultsId, "Subscription created!", "green");
                })

            }).catch(err => {
                errorShow(resultsId, err.message);
            })
        }
    })
}