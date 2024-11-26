const { register } = require('esbuild-register/dist/node')

const { unregister } = register({})

const {verifyConditions, success} = require("./lib")

exports.verifyConditions = verifyConditions
exports.success = success

unregister()
