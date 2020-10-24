const { v4: uuidv4 } = require('uuid');
const { default: PQueue } = require('p-queue');

/**
 * 
 * @param {[{}]} connSettings - an array of parameters passed to the createFunc that will created the underlying connection
 * @param {function({}): Promise<{}>} createFunc - a function that returns a promise and creates the connection
 * @param {function({}): Promise<>} destroyFunc - a function that returns a promise and destroyes a given connection
 * @param {function({}): Promise<boolean>} validateConnFunc - a function that is used to make sure that a connection is still active before the client acquires it; must return boolean value
 * @param {{}} [options={min: 1, max: 5, acquireTimeoutSeconds: 10}] - a set of options
 */
function Pool(connSettings, createFunc, destroyFunc, validateConnFunc, options = {}) {
    if (!new.target) {
        return new Pool(connSettings, createFunc, destroyFunc, validateConnFunc, options);
    }

    this.destroyFunc = destroyFunc
    this.validateConnFunc = validateConnFunc
    this.options = Object.assign({ min: 1, max: 5, acquireTimeoutSeconds: 10 }, options)
    // input validation for options    
    if (!(this.options.min >= 1 && this.options.max >= 1 && this.options.acquireTimeoutSeconds >= 1)) {
        return Promise.reject("options to the pool must satisfy the following criteria (min >=1 && max >=1 && acquireTimeoutSeconds >= 1)")
    }

    this.availableQueue = {}        // FIanyO // {_pool_conn_id: {...<actual connection object>, _pool_conn_id: ""} }
    this.unavailableQueue = {};

    /**
     * creates a connection if total connections <= max and adds it to the availableQueue
     */
    const pqueueCreate = new PQueue({ concurrency: 1 });
    this.create = () => { return pqueueCreate.add(() => _create()) }
    _create = async () => {
        let totalConnInPool = Object.keys(this.availableQueue).length + Object.keys(this.unavailableQueue).length
        if (totalConnInPool < this.options.max) {
            let _pool_conn_id = uuidv4()
            let conn = await createFunc(...connSettings)
            conn._pool_conn_id = _pool_conn_id
            this.availableQueue[_pool_conn_id] = conn
        } else {
            null // unable to create a new conn because max has been reached
        }
    }

    /**
     * destroys all connections in both available and unabvailable Queues
     */
    const pqueueDestroy = new PQueue({ concurrency: 1 });
    this.destroy = () => { return pqueueDestroy.add(() => _destroy()) }
    _destroy = async () => {
        /**
         * destroy all connections in the pool
         */
        Object.entries(this.availableQueue).forEach(async (entry) => {
            const [_pool_conn_id, conn] = entry
            await destroyFunc(this.availableQueue[_pool_conn_id])
            delete this.availableQueue[_pool_conn_id]
        })

        Object.entries(this.unavailableQueue).forEach(async (entry) => {
            const [_pool_conn_id, conn] = entry
            await destroyFunc(this.unavailableQueue[_pool_conn_id])
            delete this.unavailableQueue[_pool_conn_id]
        })
    }

    this.acquire = async () => {

        if (Object.keys(this.unavailableQueue).length === this.options.max) {
            // all connections are unavailable, so retry every second until acquireTimeoutSeconds
            return new Promise(async (resolve, reject) => {
                let timeoutAttempts = Math.ceil(this.options.acquireTimeoutSeconds)
                let attempts = 0
                let intervalId = setInterval(async () => {
                    if (Object.keys(this.availableQueue)[0]) {
                        let conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                        delete this.availableQueue[conn._pool_conn_id]
                        this.unavailableQueue[conn._pool_conn_id] = conn
                        clearInterval(intervalId)
                        return resolve(conn)
                    }
                    if (++attempts === timeoutAttempts) {
                        clearInterval(intervalId)
                        return reject("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds")
                    }
                }, 1000)
            })
        } else {
            // either conn is in availableQueue or one can be created
            let conn
            if (Object.keys(this.availableQueue).length === 0) {
                // no conn in availableQueue                
                await this.create()
                conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                if (conn) {
                    // check if we received the conn and not someone else
                    delete this.availableQueue[conn._pool_conn_id]
                    this.unavailableQueue[conn._pool_conn_id] = conn
                } else {
                    // try to acquire again
                    conn = await this.acquire()
                }
            } else {
                // conn is there in availableQueue
                conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                delete this.availableQueue[conn._pool_conn_id]
                this.unavailableQueue[conn._pool_conn_id] = conn

                // validateConnFunc before giving it out            
                if (!await this.validateConnFunc(conn)) {
                    // recursively acquire until validateConnFunc is successful
                    try {
                        await this.destroyFunc(conn)
                    } catch (e) { }
                    delete this.unavailableQueue[conn._pool_conn_id]
                    conn = await this.acquire()
                } else {
                    null
                }
            }
            return conn
        }
    }

    this.release = async (conn) => {
        delete this.unavailableQueue[conn._pool_conn_id]
        this.availableQueue[conn._pool_conn_id] = conn
    }

    return new Promise(async (resolve, reject) => {
        try {
            for (let i = 0; i < this.options.min; i++) {
                await this.create()
            }
            return resolve(this)
        } catch (e) {
            return reject(e)
        }

    })
}

module.exports.Pool = Pool