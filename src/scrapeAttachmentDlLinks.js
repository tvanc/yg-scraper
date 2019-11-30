const puppeteer = require('puppeteer')
const fs = require('fs-extra')
const path = require('path')

/** @type array */
const messages = require('../out/Messages.json')
const config = require('../config/config.json')
const passwordSubmitSelector = 'button[type="submit"][name="verifyPassword"]'
const usernameSubmitSelector = 'input[type="submit"][name="signin"]'
const outDir = path.resolve(__dirname + `/../out`)
const cacheDir = path.join(outDir, 'cache', 'attachments')
const finalOutputPath = path.join(outDir, `Attachments.json`)

const count = messages.length
const options = {}
const jsonWriteArgs = [
  { spaces: 2 },
  err => {
    if (err) {
      throw err
    }
  }
]

let failures = 0

if (config.executablePath) {
  options.executablePath = config.executablePath
}
if (config.headless !== null && config.headless !== undefined) {
  options.headless = config.headless
}

/**
 * Use data from Messages.json as a starting point.
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
  const fullData = {}

  console.log('Navigating to login page...')
  await page.goto('https://login.yahoo.com/config/login?done=https://groups.yahoo.com/neo')
  console.log('Logging in...')

  await page.waitFor(usernameSubmitSelector)
  await page.waitFor('#ad')

  console.log('Arrived at username form...')
  await page.type('input[name="username"]', config.username)
  await page.click(usernameSubmitSelector)
  console.log('Submitting username form...')

  await page.waitFor(passwordSubmitSelector)

  console.log('Filling out password form...')
  await page.type('input[name="password"]', config.password)
  await page.click(passwordSubmitSelector)
  console.log('Submitting password form...')

  // Wait for Updates banner to display
  await page.waitFor('#yg-latest-updates')

  console.log('=======================================================')
  console.log('Logged in. Now scrape for attachment-download links.')
  console.log('=======================================================')

  // Each `email` contains a subject, author, date, file count, and url to a page
  // containing links to download the attached files
  for (let i = 0; i < count; ++i) {
    const message = messages[i]
    const pageId = message.downloadPageUrl.split('/').pop()
    const filePath = path.join(cacheDir, `${pageId}.json`)
    console.log(filePath)

    if (fs.existsSync(filePath)) {
      console.log(`Skipping #${i+1} with page id: ${pageId} (File already exists: "${filePath}")`)

      fullData[pageId] = await fs.readJson(filePath)

      continue
    }

    // Navigate to download page for this message's attachments
    await page.goto(message.downloadPageUrl, {
      waitUntil: 'networkidle2',
      slowMo: 250
    })

    await page.waitFor('#right-rail-container')

    // Scrape each download page for filenames and download URLs
    try {
      const moreData = await page.evaluate(() => {
        /** @type NodeList */
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

      fullData[pageId] = { ...message, ...moreData, pageId }

      await fs.writeJson(filePath, fullData[pageId], ...jsonWriteArgs)
    } catch (exception) {
      const messageJson = JSON.stringify(message, null, 2)
      console.error(
        `Failed on message with page ID '${pageId}': ${messageJson}\n`,
        exception
      )
      ++failures
    }

    const percentage = (i / count * 100).toFixed(2)
    console.log(`${percentage}% (${i}/${count})`)
  }

  console.log('Closing browser...')
  await browser.close()

  console.log('Generating Attachments.json...')
  fs.writeJson(finalOutputPath, fullData, ...jsonWriteArgs)

  console.log('')
  console.log('=======================================================')
  console.log('')
  console.log(`Completed with ${failures} failures.`)
  console.log('')
  console.log(`Download links for ${count - failures}/${count} messages scraped successfully.`)
  console.log('')
  console.log('Complete list of attachment-download links written to:')
  console.log(`${finalOutputPath}`)
  console.log('')
  console.log('=======================================================')
  console.log('')
})()
