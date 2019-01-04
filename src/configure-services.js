const util = require('util')
const constants = require('./constants.js')
const terminateListener = require('./terminate-listener.js')

const BaseService = function(services) {}
BaseService.prototype.terminate = function() {}
BaseService.prototype.init = function(callback) {
    callback()
}

const STATE_REGISTERED = 0
const STATE_STARTING_INIT = 1
const STATE_DONE_INIT = 2
const STATE_READY = 3
const STATE_ERROR = 4

// storage for services
const _services = {

}
const _serviceInit = (svc) => {
    let f = () => {
        // init completed (if there) - mark ready
        _services[svc.name].ready = true
        _services[svc.name].state = STATE_DONE_INIT
        _services[svc.name].resolve(svc)
        
        // nudge
        _serviceNudge()
    }
    if (svc['init'] && typeof svc['init'] === 'function') {
        // get all services the service depend on
        Promise.all((svc.dependencies || []).map(key => lookupService(key))).then(args => {
            svc.init(f, ...args)
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
    let notReadySvcs = Object.values(_services).filter(wrapper => wrapper.state < STATE_STARTING_INIT)
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
        
        if (wrapper) {
            // all dependencies are ready - init
            wrapper.state = STATE_STARTING_INIT
            _serviceInit(wrapper.service)
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
    // convert supplied names to promises for services
    let svcPromise = Promise.all((Array.isArray(name) ? name : [name]).map(svcname => {
        if (_services[svcname]) {
            return _services[svcname].promise
         } else {
             return Promise.reject(`Unknown service <${svcname}>`)
         }
    }))
    let timeout
    return Promise.race([
        svcPromise,
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
    reset: () => {
        Object.keys(_services).forEach(name => delete _services[name])
    },
    registerService, 
    lookupService,
    'isReadyService': (name) => _services[name] && _services[name].ready ? true : false, 
    'terminate': () => {
        Object.values(_services).forEach(wrapper => {
            let svc = wrapper.service
            if (svc['terminate'] && typeof svc['terminate'] === 'function') {
                try {
                    svc.terminate()
                } catch (err) {
                    console.log(`Unable to correctly terminate service <${svc.name}>`, err)
                }
            }
            delete _services[wrapper.service.name]
        })
    }
}
