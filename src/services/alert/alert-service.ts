import moment from "moment-timezone";
import constants from "../../constants";
import { Logger } from "../../logger";
import { BackendIdentity, BaseService, ControlMessageTypes, Device, QueueNotifyMessage, Sensor, SensorType, TopicControlMessage, TopicSensorMessage } from "../../types";
import { PromisifiedSemaphore, objectHasOwnProperty_Trueish } from "../../utils";
import { PubsubService, TopicMessage } from "../pubsub-service";
import { IdentityService } from "../identity-service";
import { StorageService } from "../storage-service";
import {
    Alert, BinarySensorAlert, SensorSampleAlert,
    SensorValueAlert, SensorValueEventData, TimeoutAlert, TimeoutAlertEventData
} from "./alert-types";
import { QueueService } from "../queue-service";

/**
 * Used to track alert state internally.
 * 
 */
type AlertWrapper = {
    alert: Alert;
} & AlertWrapperSelector;
type AlertWrapperSelector = {
    isBinary: boolean;
    isSystem: boolean;
};

// logger 
const logger = new Logger("alert-service");

export class AlertService extends BaseService {
    public static NAME = "alert";
    private storage!: StorageService;
    private pubsub!: PubsubService;
    private queues!: QueueService;
    private serviceUser!: BackendIdentity;
    private alerts = new Map<string, Array<AlertWrapper>>();
    private alertsSem = new PromisifiedSemaphore(1);

    constructor() {
        super(AlertService.NAME);
        this.dependencies = [StorageService.NAME, IdentityService.NAME, PubsubService.NAME, QueueService.NAME];

        // show config
        logger.info(`ALERT.TIMEOUT_BINARY_SENSOR=${constants.ALERT.TIMEOUT_BINARY_SENSOR}`);
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        // get user
        const identity = services[1] as IdentityService;
        this.serviceUser = identity.getServiceBackendIdentity(AlertService.NAME);

        // get services
        this.storage = services[0] as StorageService;
        this.pubsub = services[2] as PubsubService;
        this.queues = services[3] as QueueService;

        // create alerts for binary sensors
        this.initBinarySensorAlerts();

        // create user defined alerts
        //this.initUserDefinedAlerts();

        // listen for messages about sensors coming and going
        this.pubsub.subscribe(`${constants.TOPICS.CONTROL}.*`, this.controlMessages.bind(this));

        // listen for messages when sensors post data
        this.pubsub.subscribe(`${constants.TOPICS.SENSOR}.known.*`, this.sensorTopicMessages.bind(this));

        // callback
        logger.info("Initialized alert-service");
        callback();
    }

    private async modifyAlertState(cb: () => void) {
        try {
            await this.alertsSem.take();
            cb();
        } catch (err) {
            logger.warn(`Unable to modify alert state`);
        }
        this.alertsSem.leave();
    }

    private async addAlertToState(targetId: string, a: AlertWrapper) {
        await this.modifyAlertState(() => {
            if (this.alerts.has(targetId)) {
                this.alerts.get(targetId)!.push(a);
            } else {
                this.alerts.set(targetId, [a]);
            }
            logger.trace(`Added alert to state <${JSON.stringify(a)}>`);
        })
    }

    /*
    private async initUserDefinedAlerts() {
        // get alerts
        const alerts = await this.storage.getAlerts(this.serviceUser, undefined, NullableBoolean.yes);
        alerts.filter((a) => null !== a).forEach((a) => this.initUserDefinedAlert(a!));
    }

    private async initUserDefinedAlert(a: Alert): Promise<void> {
        logger.info(
            `Initializing user defined alert <${a.id}> for <${a.target.id}> / <${a.target.name}> via <${a.notifyType}>`
        );
        return new Promise<void>(async (resolve) => {
            // add to state
            await this.addAlertToState(a.target.id, {
                alert: a, 
                isBinary: false,
                isSystem: false
            });

            if (a instanceof TimeoutAlert) {
                // create watchdog
                logger.trace(`<${a.id} is a timeout alert - initializing watchdog`);
                a.initTimeout((a: TimeoutAlert) => {
                    this.onAlertTimeout(a);
                });
            }
            resolve();
        });
    }
    */

    private async initBinarySensorAlerts() {
        if (objectHasOwnProperty_Trueish(process.env, "ALERTS_BINARY_SENSOR_DISABLE")) {
            logger.warn(`ALERTS_BINARY_SENSOR_DISABLE is set to trueish so disable binary sensor enablement`);
            return;
        }

        // get binary sensors
        const binarySensors = await this.storage.getSensors(this.serviceUser, {
            type: SensorType.binary,
        });
        await Promise.all(binarySensors.map((s) => this.initBinarySensorAlert(s)));
    }

    private async initBinarySensorAlert(s: Sensor): Promise<void> {
        logger.info(`Initializing alert for binary sensor - sensor id <${s.id}> name <${s.name}>`);
        return new Promise<void>(async (resolve) => {
            // create object
            const a = new BinarySensorAlert(s, {
                timeoutMs: constants.ALERT.TIMEOUT_BINARY_SENSOR,
            } as TimeoutAlertEventData);

            // add to state
            await this.addAlertToState(s.id, {
                alert: a, 
                isSystem: true,
                isBinary: true
            });

            // create watchdog
            a.initTimeout((a: TimeoutAlert) => {
                this.onAlertTimeout(a);
            });
            resolve();
        });
    }

    private async onAlertTimeout(a: TimeoutAlert) {
        if ("device" in a.target) {
            // sensor
            logger.debug(`Alert timeout for alert id <${a.id}> - sensor id <${a.target.id}> name <${a.target.name}>`);
            this.onSensorAlertTimeout(a);
        } else {
            // device
            logger.debug(`Alert timeout for alert id <${a.id}> - device id <${a.target.id}> name <${a.target.name}>`);
            this.onDeviceAlertTimeout(a);
        }
    }

    private async onSensorAlertTimeout(a: TimeoutAlert) {
        // log
        const sensor = a.target as Sensor;
        logger.info(`Alert timeout id <${a.id}> - Sensor Alert Timeout id <${sensor.id}> name <${sensor.name}> type <${sensor.type}>`);

        // publish on topic
        const payload: TopicControlMessage = {
            type: ControlMessageTypes.timeout,
            device: sensor!.device,
            deviceId: sensor!.deviceId,
            sensor: sensor,
            sensorId: sensor.id,
        };
        this.pubsub.publish(`${constants.TOPICS.CONTROL}.known.sensor.${ControlMessageTypes.timeout}`, payload);

        if (SensorType.binary === sensor.type) {
            // add sensor reading for binary sensor
            this.storage.persistSensorSample(sensor, 0, moment.utc());
        }

        // notify
        this.notify(a, {
            timeout: (a.eventData as TimeoutAlertEventData).timeout,
        });
    }

    private async onDeviceAlertTimeout(a: TimeoutAlert) {
        // log
        const device = a.target as Device;
        logger.info(
            `Alert timeout id <${a.id}> - Device Alert Timeout id <${device.id}> name <${device.name}>`
        );

        // publish on topic
        const payload: TopicControlMessage = {
            type: ControlMessageTypes.timeout,
            device: device!,
            deviceId: device!.id,
        };
        this.pubsub.publish(`${constants.TOPICS.CONTROL}.known.device.${ControlMessageTypes.timeout}`, payload);

        // notify
        this.notify(a, {
            timeout: (a.eventData as TimeoutAlertEventData).timeout,
        });
    }

    /**
     * Process messages about sensor data.
     *
     * @param result
     */
    private async sensorTopicMessages(result: TopicMessage) {
        // get msg and log
        const msg = result.data as TopicSensorMessage;
        logger.debug(
            `Received message on channel <${result.channel}> for sensor id <${msg.sensorId}> value <${msg.value}>`
        );

        // process alerts for known sensor
        this.processAlertTargets(
            msg.sensorId,
            undefined,
            (a) => {
                const alert = a.alert;
                if (alert instanceof TimeoutAlert) {
                    alert.feed();
                } else if (alert instanceof SensorSampleAlert) {
                    this.notify(alert, {});
                } else if (alert instanceof SensorValueAlert) {
                    const data = alert.eventData as SensorValueEventData;
                    if (data.match(msg.value)) this.notify(alert, { value: msg.value });
                }
            },
            undefined
        );
    }

    /**
     * Process messages about elements of interest coming and going
     * @param result
     */
    private async controlMessages(result: TopicMessage) {
        logger.debug(`Received controlMessage on channel ${result.channel}`);
        if (result.channel.startsWith(`${constants.TOPICS.CONTROL}.sensor.`)) return this.sensorControlMessages(result);
        if (result.channel.startsWith(`${constants.TOPICS.CONTROL}.alert.`)) return this.alertControlMessages(result);
    }

    /**
     * Process messages about alerts coming and going
     * @param result
     */
    private async alertControlMessages(result: TopicMessage) {
        const parts = result.channel.split(".");
        if (parts[2] === "create") {
            // new alert was created
            const id = result.data.new.id;
            logger.info(`Alert with ID ${id} was created`);
            //const alert = await this.storage.getAlert(this.serviceUser, id);
            //this.initUserDefinedAlert(alert);
        } else if (parts[2] === "update") {
            // sensor was updated
            const id = result.data.new.id;
            logger.info(`Alert with ID ${id} was updated`);
        } else if (parts[2] === "delete") {
            // alert was deleted
            const id = result.data.old.targetId;
            logger.info(`Alert with ID ${id} was deleted`);
            this.deleteAlertsForTarget(id);
        }
    }

    /**
     * Process messages about sensors coming and going
     * @param result
     */
    private async sensorControlMessages(result: TopicMessage) {
        const parts = result.channel.split(".");
        if (parts[2] === "create") {
            // new sensor was created
            const sensorId: string = result.data.new.id;
            const sensorType: SensorType = result.data.new.type;
            if (SensorType.binary === sensorType) {
                logger.info(`Binary sensor with ID <${sensorId}> was created - adding alert`);
                this.initBinarySensorAlert(result.data.new as Sensor);
            }
        } else if (parts[2] === "update") {
            // sensor was updated
            const sensorId = result.data.new.id;
            const newSensorType: SensorType = result.data.new.type;
            const oldSensorType: SensorType = result.data.old.type;
            if (SensorType.binary === newSensorType && SensorType.binary !== oldSensorType) {
                // sensor changed type to binary - add binary sensor alert
                this.initBinarySensorAlert(result.data.new as Sensor);
            } else if (SensorType.binary !== newSensorType && SensorType.binary === oldSensorType) {
                // sensor changed type from binary - delete binary sensor alert
                this.deleteAlertsForTarget(sensorId, {
                    isSystem: true,
                    isBinary: true
                });

            } else {
                // treat like a regular sensor update
                logger.info(`Non-binary sensor with ID <${sensorId}> was updated - update target in any alerts`);
                await this.processAlertTargets(
                    sensorId,
                    undefined,
                    (a) => {
                        a.alert.target = result.data.new as Sensor;
                    },
                    undefined
                );
            }
        } else if (parts[2] === "delete") {
            // sensor was deleted
            const sensorId = result.data.old.id;
            this.deleteAlertsForTarget(sensorId);
        }
    }

    /**
     * Remove alert(s) for specified target id optionally matching selector. If no 
     * selector is passed all alerts for that targetId is removed.
     *
     * @param targetId
     * @param selector
     */
    private async deleteAlertsForTarget(targetId: string, selector?: AlertWrapperSelector) {
        logger.debug(`Target with ID <${targetId}> was deleted - removing alert(s)`);
        const isAlertWrapperMatchesSelector = (a: AlertWrapper) => {
            if (selector && selector.isBinary === a.isBinary && selector.isSystem === a.isSystem) {
                // selector supplied and it matches
                return true;
            } else if (!selector) {
                // no selector supplied
                return true
            } else {
                // selector and it doesn't match
                return false;
            }
        }
        await this.processAlertTargets(
            targetId,
            undefined,
            (a) => {
                let alert: Alert | undefined;
                if (isAlertWrapperMatchesSelector(a)) {
                    alert = a.alert;
                }
                if (!alert) return;

                if (alert instanceof TimeoutAlert) {
                    logger.debug(`Found timeout alert for ID <${alert.id}> - stopping watchdog`);
                    alert.wd.removeAllListeners();
                    alert.wd.sleep();
                }
            },
            () => {
                if (!selector) {
                    // remove all alerts
                    this.alerts.delete(targetId);
                } else {
                    // remove if selector matches
                    const existingWrappers = this.alerts.get(targetId)!;
                    const newWrappers = existingWrappers.reduce((prev, a) => {
                        if (isAlertWrapperMatchesSelector(a)) prev.push(a);
                        return prev;
                    }, [] as Array<AlertWrapper>);
                    if (newWrappers.length) {
                        this.alerts.set(targetId, newWrappers);
                    } else {
                        this.alerts.delete(targetId);
                    }
                }
            }
        );
    }

    /**
     * Helper method for looping through alerts for a specific sensor ID / device ID.
     *
     * @param id
     * @param before
     * @param loop
     * @param after
     */
    private async processAlertTargets(
        id: string,
        before: (() => void) | undefined,
        loop: (a: AlertWrapper) => void,
        after: (() => void) | undefined
    ): Promise<void> {
        try {
            await this.alertsSem.take();
            if (before) before();
            const alerts: AlertWrapper[] | undefined = this.alerts.get(id);
            (alerts || []).forEach((a) => {
                loop(a);
            });
            if (after) after();
            this.alertsSem.leave();
        } catch (err) {}
    }

    private async notify(a: Alert, data: any): Promise<void> {
        if (!a.userId || !a.notifyType) return;
        this.queues.publish(constants.QUEUES.NOTIFY, {
            userId: a.userId,
            alertId: a.id,
            eventType: a.eventType,
            notifyType: a.notifyType,
            target: a.target.id,
            data,
        } as QueueNotifyMessage);
    }
}
