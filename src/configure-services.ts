import { BaseService, InitCallback } from "./types";
import constants from "./constants";
import { Logger } from "./logger";

const logger = new Logger("configure-services");

const STATE_REGISTERED = 0;
const STATE_STARTING_INIT = 1;
const STATE_RETRY_INIT = 2;
const STATE_READY = 3;
const STATE_ERROR = 4;

const INIT_RETRY_SECONDS = Number(process.env.SERVICES_INIT_RETRY_SECONDS) || 5;
const NUDGE_RETRY_SECONDS = Number(process.env.SERVICES_NUDGE_RETRY_SECONDS) || 2;

interface ServiceWrapper {
    service: BaseService;
    promise: Promise<BaseService>;
    resolve: (svc: BaseService) => void;
    reject: (err: Error) => void;
    state: number;
    ready?: boolean;
    error?: Error;
    retryAfter?: number;
}

const _services: Record<string, ServiceWrapper> = {};

const _serviceInit = (svc: BaseService) => {
    const f: InitCallback = (err?: Error) => {
        if (err) {
            logger.warn(`init-method of ${svc.name}-service did callback to service broker with error - retrying init in ${INIT_RETRY_SECONDS} seconds`, err);
            _services[svc.name].state = STATE_RETRY_INIT;
            _services[svc.name].retryAfter = Date.now() + (INIT_RETRY_SECONDS * 1000);
        } else {
            logger.debug(`init-method of ${svc.name}-service called back without error`);
            if (!_services[svc.name]) {
                logger.error(`Unable to find ${svc.name}-service - ABORTING!!`);
                return;
            }
            _services[svc.name].ready = true;
            _services[svc.name].state = STATE_READY;
            _services[svc.name].resolve(svc);
        }
        _serviceNudge();
    };

    if (svc.init && typeof svc.init === "function") {
        Promise.all((svc.dependencies || []).map(key => lookupService(key))).then(args => {
            svc.init(f, args as BaseService[]);
        }).catch(err => {
            _services[svc.name].error = err;
            _services[svc.name].state = STATE_ERROR;
            _services[svc.name].reject(err);
            _serviceNudge();
        });
    } else {
        f();
    }
};

const _serviceNudge = () => {
    const notReadySvcs = Object.values(_services).filter(wrapper => wrapper.state < STATE_READY);
    if (notReadySvcs && notReadySvcs.length > 0) {
        let wrapper: ServiceWrapper | undefined = notReadySvcs.reduce<ServiceWrapper | undefined>((prev, w) => {
            if (prev) return prev;
            const svc = w.service;
            const dependencies = svc.dependencies && Array.isArray(svc.dependencies) ? svc.dependencies : [];
            const readyDependencies = dependencies.filter(dep => _services[dep] && _services[dep].ready);
            if (dependencies.length && dependencies.length === readyDependencies.length) {
                return w;
            }
            return prev;
        }, undefined);

        if (wrapper && wrapper.state === STATE_RETRY_INIT) {
            if (wrapper.retryAfter !== undefined && wrapper.retryAfter < Date.now()) {
                logger.debug(`Service '${wrapper.service.name}' is ready for retry`);
            } else {
                logger.debug(`Service '${wrapper.service.name}' is NOT ready for retry`);
                wrapper = undefined;
            }
        }
        if (wrapper && (wrapper.state === STATE_REGISTERED || wrapper.state === STATE_RETRY_INIT)) {
            wrapper.state = STATE_STARTING_INIT;
            delete wrapper.retryAfter;
            _serviceInit(wrapper.service);
        } else {
            global.setTimeout(_serviceNudge, NUDGE_RETRY_SECONDS * 1000);
        }
    }
};

export const registerService = (svc: BaseService): Promise<BaseService> => {
    if (Object.keys(_services).includes(svc.name)) {
        return Promise.reject(new Error(`Service with name <${svc.name}> already registered`));
    }

    const wrapper = {
        service: svc,
        state: STATE_REGISTERED,
    } as ServiceWrapper;

    const promise = new Promise<BaseService>((resolve, reject) => {
        wrapper.reject = reject;
        wrapper.resolve = resolve;
    });
    wrapper.promise = promise;
    _services[svc.name] = wrapper;

    global.setImmediate(() => {
        const dependencies = svc.dependencies && Array.isArray(svc.dependencies) ? svc.dependencies : [];
        if (!dependencies.length) {
            _serviceInit(svc);
        } else {
            _serviceNudge();
        }
    });

    return promise;
};

export function lookupService(name: string, timeoutService?: number): Promise<BaseService>;
export function lookupService(name: string[], timeoutService?: number): Promise<BaseService[]>;
export function lookupService(name: string | string[], timeoutService: number = constants.DEFAULTS.SERVICE.LOOKUP_TIMEOUT): Promise<BaseService | BaseService[]> {
    let timeout: ReturnType<typeof setTimeout>;
    logger.trace(`lookupServices asked for following services <${name}> with timeout <${timeoutService}>`);
    return Promise.race([
        Promise.all((Array.isArray(name) ? name : [name]).map(n => {
            if (_services[n]) {
                logger.trace(`Found ${n} service right away so simply returning promise for it`);
                return _services[n].promise;
            }
            return new Promise<BaseService>((resolve) => {
                const seeIfServiceAdded = () => {
                    if (_services[n]) {
                        logger.info(`${n} service NOW FOUND - returning promise for it`);
                        _services[n].promise.then(resolve);
                        return;
                    }
                    logger.info(`${n} service STILL not found - waiting for it...`);
                    global.setTimeout(seeIfServiceAdded, 100);
                };
                logger.info(`${n} service not found during initial lookup - waiting for it...`);
                global.setTimeout(seeIfServiceAdded, 100);
            });
        })),
        new Promise<BaseService[]>((_, reject) => {
            timeout = global.setTimeout(() => {
                reject(new Error(`Time out looking up service <${name}>`));
            }, timeoutService);
        })
    ]).then(svc => {
        global.clearTimeout(timeout);
        return Array.isArray(name) ? svc : svc[0];
    });
}

export const getService = <T extends BaseService>(name: string): T | undefined => {
    const s = _services[name];
    if (!s) return undefined;
    return s.service as T;
};

export const isReadyService = (name: string): boolean => {
    return _services[name] && _services[name].ready ? true : false;
};

export const terminate = (): void => {
    Object.values(_services).forEach(wrapper => {
        const svc = wrapper.service;
        if (svc.terminate && typeof svc.terminate === "function") {
            try {
                svc.terminate();
            } catch (err) {
                logger.error(`Unable to correctly terminate service <${svc.name}>`, err);
            }
        }
        delete _services[wrapper.service.name];
    });
};

export default { registerService, lookupService, getService, isReadyService, terminate };
