/**
 * tests against no external library
 */

// standard requires for all test suites
const Pool = require('./index');
const tests = require('./tests')

let connSettings = ["a", {}]
let dummyConnObj = { "connection_id": 123 }
let createFunc = async () => { return {...dummyConnObj} }   // must return a new object everytime
let destroyFunc = async () => { }
let validateConnFunc = async () => { return true }

// standard tests for all test suites
tests(Pool, connSettings, createFunc, destroyFunc, validateConnFunc);