const {BaseService} = require("./types");
const util = require('util');
const constants = require('./constants').default;
const terminateListener = require('./terminate-listener').default;
const { Logger } = require("./logger");

const logger = new Logger("configure-services");

const STATE_REGISTERED = 0
const STATE_STARTING_INIT = 1
const STATE_RETRY_INIT = 2
const STATE_READY = 3
const STATE_ERROR = 4

const INIT_RETRY_SECONDS = process.env.SERVICES_INIT_RETRY_SECONDS || 5
const NUDGE_RETRY_SECONDS = process.env.SERVICES_NUDGE_RETRY_SECONDS || 2

// storage for services
const _services = {}

const _serviceInit = (svc) => {
    let f = (err) => {
        // see if called back with error
        if (err) {
            // init failed due to dependent service error - retrying
            logger.warn(`init-method of ${svc.name}-service did callback to service broker with error - retrying init in ${INIT_RETRY_SECONDS} seconds`, err)
            _services[svc.name].state = STATE_RETRY_INIT
            _services[svc.name].retryAfter = Date.now() + (INIT_RETRY_SECONDS*1000)
        } else {
            // init completed (if there) - mark ready
            logger.debug(`init-method of ${svc.name}-service called back without error`)
            if (!_services[svc.name]) {
                logger.error(`Unable to find ${svc.name}-service - ABORTING!!`)
                return
            }
            _services[svc.name].ready = true
            _services[svc.name].state = STATE_READY
            _services[svc.name].resolve(svc)
        }
        
        // nudge
        _serviceNudge()
    }
    if (svc['init'] && typeof svc['init'] === 'function') {
        // get all services the service depend on
        Promise.all((svc.dependencies || []).map(key => lookupService(key))).then(args => {
            svc.init(f, args)
        }).catch(err => {
            _services[svc.name].error = err
            _services[svc.name].state = STATE_ERROR
            _services[svc.name].reject(err)
            _serviceNudge()
        })
    } else {
        f()
    }
}
const _serviceNudge = () => {
    // find the first non-ready service
    let notReadySvcs = Object.values(_services).filter(wrapper => wrapper.state < STATE_READY)
    if (notReadySvcs && notReadySvcs.length > 0) {
        // get first service where all dependencies are ready
        let wrapper = notReadySvcs.reduce((prev, wrapper) => {
            if (prev) return prev;

            // ensure all dependencies are ready
            let svc = wrapper.service
            const dependencies = svc['dependencies'] && Array.isArray(svc.dependencies) ? svc.dependencies : []
            const readyDependencies = dependencies.filter(dep => _services[dep] && _services[dep].hasOwnProperty('ready') && _services[dep].ready)
            if (dependencies.length && dependencies.length === readyDependencies.length) {
                return wrapper
            }
        }, undefined)
        
        if (wrapper && wrapper.state === STATE_RETRY_INIT) {
            // found service with all dependencies ready - check state and retryAfter is there
            // waiting for retry - see if time has passed
            if (wrapper.hasOwnProperty('retryAfter') && wrapper.retryAfter < Date.now()) {
                // ready for retry
                logger.debug(`Service '${wrapper.service.name}' is ready for retry`)
            } else {
                // not enough time has passed
                logger.debug(`Service '${wrapper.service.name}' is NOT ready for retry`)
                wrapper = undefined
            }
        }
        if (wrapper && (wrapper.state === STATE_REGISTERED || wrapper.state === STATE_RETRY_INIT)) {
            // init
            wrapper.state = STATE_STARTING_INIT
            delete wrapper.retryAfter
            _serviceInit(wrapper.service)
        } else {
            // no service to init - wait a little
            global.setTimeout(_serviceNudge, NUDGE_RETRY_SECONDS * 1000)
        }
    }
}
const registerService = (svc) => {
    if (Object.keys(_services).includes(svc.name)) return Promise.reject(new Error(`Service with name <${svc.name}> already registered`))

    // create wrapper object and add promise
    _services[svc.name] = {
        'service': svc
    }
    let promise = new Promise((resolve, reject) => {
        _services[svc.name].reject = reject
        _services[svc.name].resolve = resolve
    })
    _services[svc.name].promise = promise
    _services[svc.name].state = STATE_REGISTERED

    // start to init the service
    global.setImmediate(() => {
        // see if any dependencies
        const dependencies = svc['dependencies'] && Array.isArray(svc.dependencies) ? svc.dependencies : []
        if (!dependencies.length) {
            // no dependencies - run init if available
            _serviceInit(svc)
        } else {
            _serviceNudge()
        }
    })

    // return the promise
    return promise
}
const lookupService = (name, timeoutService = constants.DEFAULTS.SERVICE.LOOKUP_TIMEOUT) => {
    let timeout;
    logger.trace(`lookupServices asked for following services <${name}> with timeout <${timeoutService}>`);
    return Promise.race([
        Promise.all((Array.isArray(name) ? name : [name]).map(name => {
                if (_services[name]) {
                    logger.trace(`Found ${name} service right away so simply returning promise for it`);
                    return _services[name].promise;
                }

                // service not registered yet - wait for it
                return new Promise((resolve, reject) => {
                    const seeIfServiceAdded = () => {
                        if (_services[name]) {
                            logger.info(`${name} service NOW FOUND - returning promise for it`);
                            _services[name].promise.then(resolve);
                            return;
                        }
                        logger.info(`${name} service STILL not found - waiting for it...`);
                        global.setTimeout(seeIfServiceAdded, 100);
                    }
                    logger.info(`${name} service not found during initial lookup - waiting for it...`);
                    global.setTimeout(seeIfServiceAdded, 100);
                })
            })
        ),
        new Promise((resolve, reject) => {
            timeout = global.setTimeout(() => {
                reject(new Error(`Time out looking up service <${name}>`))
            }, timeoutService)
        })
    ]).then(svc => {
        global.clearInterval(timeout)
        return Array.isArray(name) ? svc : svc[0]
    }).catch(err => {
        throw err
    })
}

module.exports = {
    BaseService, 
    registerService, 
    lookupService,
    'getService': (name) => {
        const s = _services[name];
        if (!s) return undefined;
        return s.service;
    },
    'isReadyService': (name) => _services[name] && _services[name].ready ? true : false, 
    'terminate': () => {
        Object.values(_services).forEach(wrapper => {
            let svc = wrapper.service
            if (svc['terminate'] && typeof svc['terminate'] === 'function') {
                try {
                    svc.terminate()
                } catch (err) {
                    logger.error(`Unable to correctly terminate service <${svc.name}>`, err)
                }
            }
            delete _services[wrapper.service.name]
        })
    }
}
