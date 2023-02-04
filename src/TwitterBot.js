const { default: ow } = require('ow')
const { chromium } = require('playwright')
const { logError, logInfo, logSuccess } = require('./utils/chalk')
const { randIntFromInterval } = require('./utils/number')

/**
 * Class representing a Twitter bot.
 */
class TwitterBot {
   /**
    * Initialize the bot
    *
    * @param options {{debugMode: boolean}}
    * @returns {Promise<void>}
    */
   async init(options = {}) {
      const { ...rest } = options

      this.browser = await chromium.launch({
         headless: false,
         ...rest,
      })
      this.context = await this.browser.newContext({
         storageState: 'storage.json',
         viewport: {
            width: 1900,
            height: 1000,
         },
         ...rest,
      })
      this.page = await this.context.newPage()
   }

   /**
    * Login to Twitter
    * @param username
    * @param password
    * @returns {Promise<void>}
    */
   async login(username, password) {
      // Validate params
      ow(username, ow.string.nonEmpty)
      ow(password, ow.string.nonEmpty)

      // Check if the user is already logged in
      const isLoggedIn = await this.checkIfLoggedIn()

      if (isLoggedIn) {
         return
      }

      try {
         // Login
         await this.page.goto('https://twitter.com/i/flow/login')
         // Fill email
         await this.page.fill('input[type="text"]', username)
         // Click next button with text "Next"
         await this.page.click('text=Next')
         // Fill password
         await this.page.fill('input[type="password"]', password, { timeout: 3000 })
         // Click button with text "Log in"
         await this.page.click('text=Log in')

         // Wait for the login to be completed
         await this.page.waitForNavigation()
      } catch (e) {
         logError(
            'An error occurred while trying to login to Twitter. Please check your credentials and try again.'
         )
      }
   }

   async checkIfLoggedIn() {
      // Check if the user is already logged in
      await this.page.goto('https://twitter.com/')
      await this.page.waitForSelector('nav[role="navigation"]')
      const navItems = await this.page.$$('nav[role="navigation"]')
      const navItemsChildrenLength = await navItems[0].$$eval('a', (nodes) => nodes.length)

      if (navItemsChildrenLength > 2) {
         logInfo('Already logged in to Twitter')
         return true
      }

      return false
   }

   /**
    * Perform a tweet action multiple times.
    * @param {Number} cycles - Number of cycles to perform the action.
    * @param {Object} options - Options to configure the action.
    * @param {Boolean} [options.like] - Whether to like the tweet or not.
    * @param {Boolean} [options.reply] - Whether to reply to the tweet or not.
    * @param {Function} [options.getReply] - A function to generate the reply.
    * @returns {Promise} Promise that resolves when the action is completed.
    */
   async performMultipleTweetActions(cycles, { like, reply, getReply }) {
      // Validate params
      ow(cycles, ow.number.greaterThan(0))

      // Wait for the page to load
      await this.page.waitForSelector('article[data-testid="tweet"]')

      let doneCount = 1
      while (doneCount !== cycles) {
         // Get a tweet that not liked yet
         const notLikedTweet = await this.getNotLikedTweet()
         if (notLikedTweet) {
            if (like) {
               // Click like button
               await this.likeTweet(notLikedTweet)
            }
            // Send reply
            if (reply) {
               // Open the tweet to reply
               await this.openTweet(notLikedTweet)
               // Send the reply
               await this.replyToOpenedTweet(getReply())
               // Wait for the reply to be sent
               await this.page.waitForTimeout(3000)
               // Get back
               await this.page.goBack()
            }

            logSuccess(`Done: ${doneCount} / ${cycles}`)
            doneCount++
            await this.page.waitForTimeout(randIntFromInterval(4000, 7000))
         } else {
            await this.scrollToBottom()
         }
      }
   }

   getRandomGn = () => {
      const GNs = ['Gnnn', 'GNgn', 'GnGn', 'GnGN', 'Gnnnn', 'GNNN', 'Gnnnnn']
      const hearts = ['❤️', '💛', '💚', '💙', '💜', '🖤']
      const [randomGN, randomHeart] = [GNs, hearts].map(
         (array) => array[Math.floor(Math.random() * array.length)]
      )

      // 56% chance to add a heart
      return `${randomGN}${Math.random() > 0.5 ? randomHeart : ''}`
   }

   getRandomGm = () => {
      const randomGn = this.getRandomGn()
      return randomGn.replace(/n/g, 'm').replace(/N/g, 'M')
   }

   /**
    * Get the first tweet that has not been liked.
    * @returns {Promise<Object>} The first tweet that has not been liked, or `null` if all tweets have been liked.
    */
   getNotLikedTweet = async () => {
      const tweets = await this.page.$$('article[data-testid="tweet"]')
      let notLikedTweet
      for (let i = 0; i < tweets.length; i++) {
         notLikedTweet = tweets[i]
         const likeButton = await notLikedTweet.$('div[data-testid="like"]')
         if (likeButton) {
            break
         } else {
            notLikedTweet = null
         }
      }
      return notLikedTweet
   }

   // Open tweet
   async openTweet(tweet) {
      await tweet.click({
         position: {
            x: 200,
            y: 0,
         },
      })
      // Wait for the tweet to be opened
      await this.page.waitForTimeout(3000)
   }

   // Like tweet
   async likeTweet(tweet) {
      const likeButton = await tweet.$('div[data-testid="like"]')
      await tweet.waitForElementState('visible', {
         timeout: 3000,
      })
      await likeButton.click()
   }

   // Reply to opened tweet
   async replyToOpenedTweet(reply) {
      logInfo('Reply to tweet: ' + reply)
      // CLick reply textarea
      await this.page.click('div[data-contents="true"]')
      // Type the reply
      await this.page.keyboard.type(reply)
      await this.page.$('div[data-testid="tweetButtonInline"]').then(async (el) => {
         await el.click()
      })
   }

   /**
    * - tab: 'latest' | 'people' | 'photos' | 'videos'
    *
    * @param query
    * @param options {{tab: string}}
    * @returns {Promise<void>}
    */
   async search(query, options = {}) {
      const tabs = {
         latest: 'live',
         people: 'user',
         photos: 'image',
         videos: 'video',
      }

      try {
         await this.page.goto(
            `https://twitter.com/search?q=${query}${
               options.tab in tabs ? `&f=${tabs[options.tab]}` : ''
            }`
         )

         // Wait for the page to load
         logInfo('Waiting for the page to load...')
         await this.page.waitForTimeout(5000)
      } catch (e) {
         console.error(e)
         throw new Error('Something went wrong while trying to search'.red)
      }
   }

   async scrollToBottom() {
      logInfo('Scrolling to bottom...')
      await this.page.evaluate(
         `window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })`
      )
   }

   async close() {
      await this.browser.close()
   }
}

module.exports = TwitterBot
