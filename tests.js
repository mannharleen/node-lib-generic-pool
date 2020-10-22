module.exports = (Pool, connSettings, createFunc, destroyFunc, validateConnFunc) => {
    test('creating pool with new keyword and default options', async () => {
        let pool = await new Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
        expect(Object.values(pool.availableQueue)[0]._pool_conn_id).toBeTruthy;
        expect(pool.options.min).toBe(1);
        expect(pool.options.max).toBe(5);
        expect(pool.options.acquireTimeoutSeconds).toBe(10);
        await pool.destroy()
    });
    
    test('create and destroy a pool with default options', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        await pool.destroy();
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    });
    
    test('create, acquire, release and destroy a pool with 1 connection', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn = await pool.acquire();
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        await pool.release(conn);
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        await pool.destroy();
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    });
    
    test('create 5 connections, acquire 2, release 1, acquire 3, release 2 destroy everything', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 5 });
    
        expect(Object.values(pool.availableQueue).length).toBe(5);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn1 = await pool.acquire();
        expect(Object.values(pool.availableQueue).length).toBe(4);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        let conn2 = await pool.acquire();
        expect(Object.values(pool.availableQueue).length).toBe(3);
        expect(Object.values(pool.unavailableQueue).length).toBe(2);
    
        await pool.release(conn1);
        expect(Object.values(pool.availableQueue).length).toBe(4);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        let conn3 = await pool.acquire();
        let conn4 = await pool.acquire();
        let conn5 = await pool.acquire();
        await pool.release(conn3);
        await pool.release(conn5);
        expect(Object.values(pool.availableQueue).length).toBe(3);
        expect(Object.values(pool.unavailableQueue).length).toBe(2);
    
        await pool.destroy();
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    });
    
    
    test('create pool with min = 10 and max = 2', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 10, max: 2 });
    
        expect(Object.values(pool.availableQueue).length).toBe(2);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
        await pool.destroy()
    });
    
    test('create pool with min = 2 and max = 4, and acquire progressively', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 2, max: 4 });
    
        expect(Object.values(pool.availableQueue).length).toBe(2);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn1 = await pool.acquire()
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        let conn2 = await pool.acquire()
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(2);
    
        let conn3 = await pool.acquire()
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(3);

        await pool.destroy()
    });
    
    test('create pool with min = 2 and max = 2, acquire 2, then try acquiring another that timesout after acquireTimeoutSeconds', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 2, max: 2, acquireTimeoutSeconds: 3 });
    
        expect(Object.values(pool.availableQueue).length).toBe(2);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn1 = await pool.acquire()
        let conn2 = await pool.acquire()
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(2);
    
        await expect(pool.acquire()).rejects.toEqual("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds");

        await pool.destroy()
    });
    
    test('create pool with min = 1 and max = 1, acquire 1, then try acquiring another that timesout after acquireTimeoutSeconds, then try acquiring another', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 1, max: 1, acquireTimeoutSeconds: 1 });
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn1 = await pool.acquire()    
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
        
        await expect(pool.acquire()).rejects.toEqual("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds");
        await expect(pool.acquire()).rejects.toEqual("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds");

        await pool.destroy()
    });
    
    test('create pool with min = 1 and max = 1, acquire 1, release 1, then try acquiring another that timesout after acquireTimeoutSeconds, then try acquiring another', async () => {
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { min: 1, max: 1, acquireTimeoutSeconds: 1 });
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let conn1 = await pool.acquire()    
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        await pool.release(conn1)
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
        await pool.acquire()    
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
    
        await expect(pool.acquire()).rejects.toEqual("Unable to aquire a connection. All connection are busy. Hint: Try increasing the acquireTimeoutSeconds");

        await pool.destroy()
    });
    
    
    test('acquire where validateConnFunc returns true results a conn already available in pool.availableQueue being returned', async () => {
        validateConnFunc = async () => true
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    
        expect(Object.values(pool.availableQueue).length).toBe(1);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let old_pool_conn_id = Object.keys(pool.availableQueue)[0]
        let conn1 = await pool.acquire()
        let new_pool_conn_id = Object.keys(pool.unavailableQueue)[0]
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
        expect(new_pool_conn_id).toBe(old_pool_conn_id)

        await pool.destroy()
    });
    
    test('create pool with 2 conns; acquire but validateConnFunc returns false results in deletion of connection in pool.availableQueue & new conn being created and returned', async () => {
        validateConnFunc = async () => false
        let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, {min: 2});
    
        expect(Object.values(pool.availableQueue).length).toBe(2);
        expect(Object.values(pool.unavailableQueue).length).toBe(0);
    
        let old1_pool_conn_id = Object.keys(pool.availableQueue)[0]
        let old2_pool_conn_id = Object.keys(pool.availableQueue)[1]
        let conn1 = await pool.acquire()
        let new_pool_conn_id = Object.keys(pool.unavailableQueue)[0]
        expect(Object.values(pool.availableQueue).length).toBe(0);
        expect(Object.values(pool.unavailableQueue).length).toBe(1);
        expect(new_pool_conn_id).not.toBe(old1_pool_conn_id)
        expect(new_pool_conn_id).not.toBe(old2_pool_conn_id)
        expect(new_pool_conn_id).toBe(pool.unavailableQueue[new_pool_conn_id]['_pool_conn_id'])

        await pool.destroy()
    });
    
};