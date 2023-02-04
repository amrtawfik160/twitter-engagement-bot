const chalk = require('chalk')

const error = chalk.bold.red
const warning = chalk.hex('#FFA500')
const success = chalk.hex('#33d933')
const info = chalk.hex('#00BFFF')

const logError = (message) => {
   console.log(error(message))
}

const logWarning = (message) => {
   console.log(warning(message))
}

const logSuccess = (message) => {
   console.log(success(message))
}

const logInfo = (message) => {
   console.log(info(message))
}

module.exports = {
   logError,
   logWarning,
   logSuccess,
   logInfo,
}
