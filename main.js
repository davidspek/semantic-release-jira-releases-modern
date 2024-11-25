const { register } = require('esbuild-register/dist/node')

const { unregister } = register({})

const {verifyConditions, success} = require("./src")

exports.verifyConditions = verifyConditions
exports.success = success

unregister()
