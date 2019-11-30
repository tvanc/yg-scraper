const puppeteer = require('puppeteer')
const fs = require('fs-extra')
const path = require('path')
const partialAttachmentData = require('../out/partialAttachmentData.json')
const config = require('../config/config.json')
const nameFieldSelector = 'input[name="username"]'
const passFieldSelector = 'input[name="password"]'

const count = partialAttachmentData.length
const failures = 0
const options = {}

if (config.executablePath) {
  options.executablePath = config.executablePath
}
if (config.headless !== null && config.headless !== undefined) {
  options.headless = config.headless
}

/**
 * Use data from partialAttachmentData.json as a starting point.
 *
 * Iterate over each message. Get download links for each attachment and save them as JSON.
 *
 * Provide your Yahoo account credentials via config/config.json.
 *
 * You can also use config.json to provide "headless" and "executablePath" options to puppeteer.
 */
(async () => {
  console.log('Launching browser...')

  const browser = await puppeteer.launch(options)
  const page = await browser.newPage()

  console.log('Navigating to login page...')
  await page.goto('https://login.yahoo.com/config/login?done=https://groups.yahoo.com/neo', {
    waitUntil: 'networkidle2',
    slowMo: 125
  })

  await page.waitFor(nameFieldSelector)

  console.log('Arrived at username form...')

  // Fill out, submit username form
  console.log('Filling out username form...')
  await page.type(nameFieldSelector, config.username)
  await page.click('input[type="submit"][name="signin"]')
  // console.log(await page.$eval('input[type="submit"][name="signin"]', el => el.click()))
  console.log('Submitting username form...')

  // Wait for password form
  await page.waitFor(passFieldSelector)

  console.log('Arrived at password form...')

  // Fill out, submit password form
  console.log('Filling out password form...')
  await page.type(passFieldSelector, config.password)
  await page.click('button[type="submit"][name="verifyPassword"]')
  console.log('Submitting password form...')

  // Wait for Updates banner to display
  await page.waitFor('#yg-latest-updates')

  console.log('Logged in...')

  // Each `email` contains a subject, author, date, file count, and url to a page
  // containing links to download the attached files
  for (let i = 0; i < count; ++i) {
    const message = partialAttachmentData[i]
    const pageId = message.pageUrl.split('/').pop()
    const filePath = path.resolve(__dirname + `/../out/attachments/${pageId}.json`)
    console.log(filePath)

    if (fs.existsSync(filePath)) {
      console.log(`Skipping #${i}, ${pageId} (File already exists: "${filePath}")`)

      continue
    }

    // Navigate to download page indicated in `email`
    await page.goto(message.pageUrl, {
      waitUntil: 'networkidle2',
      slowMo: 250
    })

    await page.waitFor('#right-rail-container')

    // Scrape each download page for filenames and download URLs
    try {
      const moreData = await page.evaluate(() => {
        const thumbContexts = document.querySelectorAll('.thumb-desc-context')
        const messageLink = document.querySelector('.att-msg-preview > a[href^="/neo/groups/"][data-rapid_p]')
        const messageId = messageLink ? messageLink.href.trim().split('/').pop() : null

        const files = [...thumbContexts].map(context => {
          const fileName = context.querySelector('.thumb-title').textContent.trim()
          const author = context.querySelector('.thumb-meta').textContent.trim()
          const downloadUrl = context.querySelector('a[href^="https://xa.yimg.com/"]').href

          return {
            fileName,
            author,
            downloadUrl
          }
        })

        return { messageId, files }
      })

      await fs.outputFile(
        filePath,
        JSON.stringify({ ...message, ...moreData, pageId }),
        err => {
          if (err) {
            throw err
          }
        }
      )
    } catch (exception) {
      const messageJson = JSON.stringify(message, null, 2)
      console.error(
        `Failed on message with page ID '${pageId}': ${messageJson}\n`,
        exception
      )
    }

    const percentage = (i / count * 100).toFixed(2)
    console.log(`${percentage}% (${i}/${count})`)
  }

  await browser.close()

  console.log(`Completed with ${failures} failures. Download links for ${count - failures} messages scraped successfully.`)
})()
