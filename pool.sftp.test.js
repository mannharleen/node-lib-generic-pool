/**
 * tests against "https://www.npmjs.com/package/ssh2-sftp-client"
 * sftpConfig.js should look like:
module.exports = {
    connSettings: [{
        host: 'xx',
        port: 22,
        username: 'xx',
        password: 'xx'
    },
    homedir: "/xx"
}]
 */

let Client, config, connSettings, createFunc, destroyFunc, validateConnFunc

try {
    Client = require('ssh2-sftp-client');
    config = require('./_sftpConfig.js');

    connSettings = config.connSettings;
    createFunc = async (connSettings) => {
        let sftp = new Client()
        await sftp.connect(connSettings)
        return sftp
    }
    destroyFunc = async (conn) => {
        await conn.end()
    }
    validateConnFunc = async (conn) => {
        try {
            await conn.cwd()
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
test("list dir that exists", async () => {
    let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    let conn = await pool.acquire();
    await expect(conn.list(config.homedir)).resolves.not.toBeNull()
    await pool.destroy()
})

test("list dir that does not exists", async () => {
    let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);
    let conn = await pool.acquire();
    await expect(conn.list('something really random like this text')).rejects.not.toBeNull()
    await pool.destroy()
})