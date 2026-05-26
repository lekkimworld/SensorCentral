import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

type HouseOption = { id: string; name: string };

export default async (elemRoot: JQuery<HTMLElement>) => {
    const container = createContainers(elemRoot, "cronjob-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ houses { id, name } }`);
    const houses: HouseOption[] = data.houses || [];

    uiutils.appendTitleRow(titleElem, "Create Cron Job");

    const houseOptions = houses.map(h => `<option value="${h.id}">${h.name}</option>`).join("");

    formElem.html(`
        <form id="cronjobCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="jobTypeInput">Job Type</label>
                        <select class="form-control" id="jobTypeInput" required>
                            <option value="smartme_powermeter">Smart-Me Powermeter</option>
                            <option value="callout">Scheduled Callout</option>
                        </select>
                        <small class="form-text text-muted">The type of cron job to create</small>
                    </div>
                    <div class="form-group">
                        <label for="houseIdInput">House</label>
                        <select class="form-control" id="houseIdInput" required>
                            <option></option>
                            ${houseOptions}
                        </select>
                        <small class="form-text text-muted">The house the powermeter belongs to</small>
                    </div>
                    <div class="form-group">
                        <label for="sensorIdInput">Sensor ID</label>
                        <input type="text" required class="form-control" id="sensorIdInput" placeholder="Enter the sensor ID">
                        <small class="form-text text-muted">The ID of the sensor to store readings to</small>
                        <div class="invalid-feedback">You must specify a sensor ID.</div>
                    </div>
                    <div class="form-group">
                        <label for="clientIdInput">OAuth Client ID</label>
                        <input type="text" required class="form-control" id="clientIdInput" placeholder="Enter the Smart-Me OAuth Client ID">
                        <small class="form-text text-muted">The client_id from your Smart-Me OAuth application</small>
                        <div class="invalid-feedback">You must specify a Client ID.</div>
                    </div>
                    <div class="form-group">
                        <label for="clientSecretInput">OAuth Client Secret</label>
                        <input type="text" required class="form-control" id="clientSecretInput" placeholder="Enter the Smart-Me OAuth Client Secret">
                        <small class="form-text text-muted">The client_secret from your Smart-Me OAuth application</small>
                        <div class="invalid-feedback">You must specify a Client Secret.</div>
                    </div>
                    <div class="form-group">
                        <label for="frequencyMinutesInput">Frequency</label>
                        <select class="form-control" id="frequencyMinutesInput" required>
                            <option value="1">Every 1 minute</option>
                            <option value="2">Every 2 minutes</option>
                            <option value="5" selected>Every 5 minutes</option>
                            <option value="10">Every 10 minutes</option>
                            <option value="15">Every 15 minutes</option>
                            <option value="30">Every 30 minutes</option>
                            <option value="60">Every 60 minutes</option>
                        </select>
                        <small class="form-text text-muted">How often to poll for new readings</small>
                    </div>
                    <div class="form-group">
                        <label for="deviceIdInput">Smart-Me Device ID (optional)</label>
                        <input type="text" class="form-control" id="deviceIdInput" placeholder="Leave blank to auto-discover">
                        <small class="form-text text-muted">The Smart-Me device ID. If omitted, auto-discovered from the /Devices endpoint.</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveCronJob">Save</button>
            <a href="#cronjobs" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("jobTypeInput")?.addEventListener("change", () => {
        const val = (document.getElementById("jobTypeInput") as HTMLSelectElement).value;
        if (val === "callout") {
            document.location.hash = "#cronjobs/create-callout";
        }
    });

    document.getElementById("saveCronJob")?.addEventListener("click", async () => {
        const form = document.getElementById("cronjobCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const freq = parseInt((document.getElementById("frequencyMinutesInput") as HTMLSelectElement).value, 10) || 5;
        const deviceId = (document.getElementById("deviceIdInput") as HTMLInputElement).value;
        const deviceIdField = deviceId ? `deviceId: "${deviceId}"` : "";

        await graphql(`mutation {
            createSmartmeCronJob(data: {
                clientId: "${(document.getElementById("clientIdInput") as HTMLInputElement).value}"
                clientSecret: "${(document.getElementById("clientSecretInput") as HTMLInputElement).value}"
                houseId: "${(document.getElementById("houseIdInput") as HTMLSelectElement).value}"
                sensorId: "${(document.getElementById("sensorIdInput") as HTMLInputElement).value}"
                frequencyMinutes: ${freq}
                ${deviceIdField}
            }) { id }
        }`);
        document.location.hash = "#cronjobs";
    });
};
