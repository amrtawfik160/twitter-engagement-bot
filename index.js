const inquirer = require('inquirer')
const { logError, logSuccess } = require('./src/utils/chalk')
const TwitterBot = require('./src/TwitterBot')

const config = require('./config.json')

// -----------------------------------------------------------------------------

const questions = [
   {
      type: 'confirm',
      name: 'manualLogin',
      message:
         'Do you want to login manually? (Recommended) - This will open a browser window and you will have to login manually.',
   },
]
// If the username is not set in the config, ask for it
if (!!config.username === false) {
   questions.push({
      type: 'input',
      name: 'username',
      message: 'What is your Twitter username?',
      when: (answers) => answers.manualLogin === false,
      validate: (input) => {
         // Check if the username is a string
         if (/[a-zA-Z]/.test(input)) {
            return true
         }
         return 'Please enter a valid username'
      },
   })
}
// If the password is not set in the config, ask for it
if (!!config.password === false) {
   questions.push({
      type: 'input',
      name: 'password',
      message: 'What is your Twitter password?',
      when: (answers) => answers.manualLogin === false,
      validate: (input) => {
         // Password is required
         if (input.length === 0) {
            return 'Please enter a password'
         }
         return true
      },
   })
}

questions.push(
   {
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: [
         {
            name: 'Say random Gm and like to tweets',
            value: 'gm',
         },
         {
            name: 'Say random Gn and like to tweets',
            value: 'gn',
         },
         {
            name: 'Like tweets',
            value: 'like_tweets',
         },
         {
            name: 'Reply and like to tweets',
            value: 'reply_tweets',
         },
      ],
   },
   {
      type: 'input',
      name: 'reply',
      message: 'What do you want to reply?',
      when: (answers) => answers.action === 'reply_tweets',
      validate: (input) => {
         // Check if not empty
         if (input.length === 0) {
            return 'Please enter a reply'
         }
         return true
      },
   },
   {
      type: 'input',
      name: 'search',
      message:
         'Do you want to search? (Leave empty to skip) - Action will be performed on the tweet in the search results',
   },
   {
      type: 'number',
      name: 'cycles',
      message: 'How many times do you want to do this action?',
      validate: (input) => {
         // Check if the input is a number
         if (Number.isInteger(input)) {
            return true
         }
         return 'Please enter a number'
      },
   }
)

// -----------------------------------------------------------------------------

inquirer
   .prompt(questions)
   .then(async (answers) => {
      const manualLogin = answers.manualLogin
      const action = answers.action
      const cycles = answers.cycles

      // Initialize the bot
      const bot = new TwitterBot()
      await bot.init()

      if (manualLogin) {
         // Check if user is not logged in
         if (!(await bot.checkIfLoggedIn())) {
            // Open the login page
            await bot.page.goto('https://twitter.com/i/flow/login')

            const { isLoggedIn } = await inquirer.prompt([
               {
                  type: 'confirm',
                  name: 'isLoggedIn',
                  message: 'Are you logged in?',
               },
            ])
            // Check if the user is logged in
            if (!isLoggedIn) {
               logError('Please login to Twitter and try again')
               process.exit(1)
            }
         }
      } else {
         const username = answers.username || config.username
         const password = answers.password || config.password
         // Login to Twitter
         await bot.login(username, password)
      }

      // Save storage state to "storage.json"
      await bot.context.storageState({ path: 'storage.json' })

      if (answers.search) {
         await bot.search(answers.search)
      }

      // Perform the action
      switch (action) {
         case 'gm':
            if (!answers.search) {
               await bot.search('Gm')
            }
            await bot.performMultipleTweetActions(cycles, {
               like: true,
               reply: true,
               getReply: () => bot.getRandomGm(),
            })
            break
         case 'gn':
            if (!answers.search) {
               await bot.search('Gn')
            }
            await bot.performMultipleTweetActions(cycles, {
               like: true,
               reply: true,
               getReply: () => bot.getRandomGn(),
            })
            break
         case 'like_tweets':
            await bot.performMultipleTweetActions(cycles, {
               like: true,
            })
            break
         case 'reply_tweets':
            await bot.performMultipleTweetActions(cycles, {
               like: true,
               reply: true,
               getReply: () => answers.reply,
            })
            break
         default:
            logError('Invalid action')
            process.exit(1)
            break
      }

      logSuccess(`Done! ${cycles} actions performed`)

      // Close the browser
      await bot.close()
   })
   .catch((error) => {
      if (error.isTtyError) {
         // Prompt couldn't be rendered in the current environment
         logError(`Prompt couldn't be rendered in the current environment`)
      } else {
         // Something else when wrong
         logError(`Something went wrong: ${error}`)
      }
   })
