"use strict";
// Polyfill process.getBuiltinModule for Node.js versions < 22 (like Electron's Node v20.9.0)
if (typeof process !== 'undefined' && !process.getBuiltinModule) {
    // @ts-ignore
    process.getBuiltinModule = function (name) {
        return require(name);
    };
}
