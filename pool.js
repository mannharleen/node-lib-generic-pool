const { v4: uuidv4 } = require('uuid');

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
    this.availableQueue = {}        // FIanyO // {_pool_conn_id: {...<actual connection object>, _pool_conn_id: ""} }
    this.unavailableQueue = {};

    /**
     * creates a connection if total connections <= max and adds it to the availableQueue
     */
    this._create = async () => {
        let totalConnInPool = Object.keys(this.availableQueue).length + Object.keys(this.unavailableQueue).length
        if (totalConnInPool < this.options.max) {
            let _pool_conn_id = uuidv4()
            // this.availableQueue[_pool_conn_id] = {
            //     _pool_conn_id: _pool_conn_id,
            //     ...await createFunc(...connSettings)
            // }
            let conn = await createFunc(...connSettings)
            conn._pool_conn_id = _pool_conn_id
            this.availableQueue[_pool_conn_id] = conn
        }
    }

    this.destroy = async () => {
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
            // all connections are unavailable, so wait until acquireTimeoutSeconds
            return new Promise(async (resolve, reject) => {
                let timeoutAttempts = Math.ceil(this.options.acquireTimeoutSeconds)
                let attempts = 0
                let intervalId = setInterval(async () => {
                    if (Object.keys(this.availableQueue)[0]) {
                        let conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                        delete this.availableQueue[conn._pool_conn_id]
                        this.unavailableQueue[conn._pool_conn_id] = conn
                        resolve(conn)
                    }
                    if (++attempts === timeoutAttempts) {
                        clearInterval(intervalId)
                        reject("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds")
                    }
                }, 1000)
            })
        } else {
            let conn
            if (Object.keys(this.availableQueue).length === 0) {
                await this._create()
                conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                delete this.availableQueue[conn._pool_conn_id]
                this.unavailableQueue[conn._pool_conn_id] = conn
            } else {
                conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                delete this.availableQueue[conn._pool_conn_id]

                // validateConnFunc before giving it out            
                if (!await this.validateConnFunc(conn)) {
                    // recursively acquire until validateConnFunc is successful                    
                    await this.destroyFunc(conn)
                    conn = await this.acquire()

                    // await this._create()
                    // conn = this.availableQueue[Object.keys(this.availableQueue)[0]]
                    // delete this.availableQueue[conn._pool_conn_id]
                } else {
                    this.unavailableQueue[conn._pool_conn_id] = conn
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
        for (let i = 0; i < this.options.min; i++) {
            await this._create()
        }
        resolve(this)
    })
}

module.exports.Pool = Pool