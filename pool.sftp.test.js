/**
 * tests against "ssh2-sftp-client"
 */
const Client = require('ssh2-sftp-client');
const config = require('./_sftpConfig.js')

// standard requires for all test suites
const Pool = require('./index');
const tests = require('./tests')


let connSettings = [config.connSettings];
let createFunc = async (connSettings) => { 
    let sftp = new Client()
    await sftp.connect(connSettings)
    return sftp
}
let destroyFunc = async (conn) => { 
    await conn.end()
}
let validateConnFunc = async (conn) => {
    try {
        await conn.cwd()
        return true
    } catch (e) {
        return false
    }
};

// standard tests for all test suites
// !!! uncomment
// tests(Pool, connSettings, createFunc, destroyFunc, validateConnFunc);

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