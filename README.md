# lib-generic-pool
This library provides a simple yet powerful way of implementing connection (& other kind of) pools. It works as a wrapper using existing `underlying libraries` (see FAQs)

# Philosophy
1. No bells and whistles
2. Keep it simple silly

# Table of contents

- [lib-generic-pool](#lib-generic-pool)
- [Philosophy](#philosophy)
- [Usage](#usage)
- [API](#api)
  - [Pool](#pool)
  - [pool.acquire](#poolacquire)
  - [pool.release](#poolrelease)
  - [pool.destroy](#pooldestroy)
  - [pool._create](#poolcreate)
- [FAQ](#faq)
- [Examples](#examples)
  - [Using `ssh2-sftp-client`](#using-ssh2-sftp-client)

# Usage

```js
const Pool = require('lib-generic-pool');
/*
create a pool by providing at least these 4 parameters:
    - connSettings: an array of parameters passed to the createFunc that will created the underlying connection
    - createFunc: a function that returns a promise and creates the connection
    - destroyFunc: a function that returns a promise and destroyes a given connection
    - validateConnFunc - a function that is used to make sure that a connection is still active before the client acquires it; must return boolean value
*/

//// pre-requisites

let connSettings = ["10.1.1.1", {"username": "xxx", "password": "xxx"}]
let createFunc = async (connSettings) => { 
    // uses connSettings and then returns the connection using underlying library methods
    return { "key1": "value1" } 
    }
let destroyFunc = async (conn) => {// uses the conn and then ends/destroys using underlying library methods
}
let validateConnFunc = async (conn) => { return true }

//// working with the pool

// create pool
let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc);

// acquire conn
let conn1 = await pool.acquire()

// do something with it
// ...

// release conn
await pool.release(conn1)

// destroy pool
await pool.destroy()
```
# API

## Pool
Creates a new pool and initializes with the options.min number of connections

```
let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, options);
```
- `connSettings`: an array of parameters passed to the createFunc that will created the underlying connection
- `createFunc`: a function that takes in connSettings and returns a promise that resolves to a newly created connection
- `destroyFunc`: a function that takes in a conn and returns a promise that resolves once the conn has been  destroyed/ended
- `validateConnFunc`: a function that takes in a conn and checks if the conn is still active before the client acquires it; must return a promise that resolves to a boolean value
- `options`: a set of options for the pool
    - `min`: minimum number of connections the pool maintains. (default = 1)
    - `max`: maximum number of connections the pool maintains. (default = 5)
    - `acquireTimeoutSeconds`: max seconds an acquire call will wait for a resource before timing out (default = 10)

## pool.acquire
Acquire a connection from the pool. 

- It will attempt to create a new connection if 
    - all existing connections are being used
    - no. of existing connections < options.max
- If no. of existing connections = options.max
    - It will check every second until options.acquireTimeoutSeconds for an existing connection to be available again. If none of the connections become available, it will return with a rejected promise
- If there is an error in the acquired connection, the client should release and acquire a new connection

It also validates an existing connection using `validateConnFunc` before returning it to the client. This helps auto cycle connections that are closed by the underlying library.

## pool.release
Makes an existing connection available in the pool again

## pool.destroy
Destoys all connections in the pool using `destroyFunc`

## pool._create
*Interal API and should not be directly used by clients*

# FAQ

- Q: What `underlying libraries` can be used with lib-generic-pool ?
    - A: Any library that manages connections. However, the lib is oficially been tested with the following:
        - ssh2-sftp-client

# Examples

## Using `ssh2-sftp-client`

### Using async await
```js
let connSettings = [{
    host: 'xxx',
    username: 'xxx',
    password: 'xxx'
}];
let createFunc = async (connSettings) => {
    let sftp = new Client()
    await sftp.connect(connSettings)
    return sftp
};
let destroyFunc = async (conn) => {
    conn.end()
};

let validateConnFunc = async (conn) => {
    try {
        // simply using cwd api to establish validity
        await conn.cwd()
        return false
    } catch (e) {
        return false
    }
};

const { Pool } = require('./pool');


(async () => {
    let pool = await Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { acquireTimeoutSeconds: 5, max: 1 });
    try {
        let conn1 = await pool.acquire()        
        console.log('list dir = ', await conn1.list('/directoryA'));
        await pool.release(conn1)
        
        // will wait upto 5 secs and then use the same connection (conn1)
        let conn2 = await pool.acquire()        
        console.log('list dir = ', await conn2.list('/directoryA'));
    } catch(e) {
        console.error(e)
    }    
    await pool.destroy()    
})().catch(e => { console.error(e) })
```

### using promise then catch all
```js
Pool(connSettings, createFunc, destroyFunc, validateConnFunc, { acquireTimeoutSeconds: 5, max: 1 })
    .then(pool => {
        let promise1 =
            pool.acquire()
                .then(conn => {
                    return conn.list('/directoryA')
                        .then(ls => { console.log(ls); return })
                })

        let promise2 =
            // will wait upto 5 secs and then use the same connection (conn1)
            pool.acquire()
                .then(conn => {
                    return conn.list('/directoryA')
                        .then(ls => { console.log(ls); return })
                })

        Promise.all([promise1, promise2]).then(
            pool.destroy
        )

    })
    .catch(e => { console.error(e) })
```