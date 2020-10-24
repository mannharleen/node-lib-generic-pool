/**
 * tests against "https://www.npmjs.com/package/redis"
 * sftpConfig.js should look like:
module.exports = {
    connSettings: [{
        url: 'xx'       // format = [redis[s]:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]        
    }]
}
 */
const { promisify } = require('util');
let redis, config, connSettings, createFunc, destroyFunc, validateConnFunc

try {
    redis = require('redis');
    config = require('./_redisConfig.js');

    connSettings = config.connSettings;
    createFunc = async (options) => {
        let client = redis.createClient(options);
        // create promisified versions for future use
        client._info = promisify(client.info).bind(client);
        client._unref = promisify(client.unref).bind(client);
        return client
    }
    destroyFunc = async (conn) => {        
        // await conn._quit()        
        // await conn.end(false)
        await conn.unref()        
    }
    validateConnFunc = async (conn) => {
        try {
            await conn._info()
            return true
        } catch (e) {
            return false
        }
    };

} catch (e) {
    console.warn(`Skipping test file named: ${__filename.slice(__dirname.length + 1)}. Reason:`, e.message);
    test = test.skip
}

// standard requires for all test suites
const Pool = require('./index');
const tests = require('./tests')

// standard tests for all test suites
tests(Pool, connSettings, createFunc, destroyFunc, validateConnFunc);

// additional tests
test("running redis.info", async () => {
    let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    let conn = await pool.acquire();
    try {
        await expect(conn._info()).resolves.not.toBeNull()
    } finally {
        await pool.destroy()
    }   
    
})

// test("list dir that does not exists", async () => {
//     let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
//     let conn = await pool.acquire();
//     await expect(conn.list('something really random like this text')).rejects.not.toBeNull()
//     await pool.destroy()
// })

// !!! delete these pl
// x = createFunc().then(y => {
//     y.quit()
// })
