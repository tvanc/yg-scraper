const puppeteer = require('puppeteer')
const fs = require('fs-extra')
const path = require('path')
const download = require('puppeteer-file-downloader').download

/** @type array */
const messages = require('../out/BareMessages.json')
const config = require('../config/config.json')
const usernameSubmitSelector = 'input[type="submit"][name="signin"]'
const passwordSubmitSelector = 'button[type="submit"][name="verifyPassword"]'
const usernameFieldSelector = 'input[name="username"]'
const passwordFieldSelector = 'input[name="password"]'
const outDir = path.resolve(__dirname + `/../out`)
const dataCacheDir = path.join(outDir, 'cache', 'attachments', 'data')
const fileCacheDir = path.join(outDir, 'cache', 'attachments', 'files')
const finalOutputPath = path.join(outDir, `MessagesWithAttachments.json`)

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
 * Use data from BareMessages.json as a starting point.
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
  await page.goto('https://login.yahoo.com/config/login?done=https://groups.yahoo.com/neo', {
    waitUntil: 'networkidle0',
    slowMo: 250
  })
  console.log('Logging in...')

  await page.waitFor(usernameFieldSelector)

  console.log('Arrived at username form...')
  await page.type(usernameFieldSelector, config.username)
  await page.waitFor(usernameSubmitSelector + ':enabled')
  await page.click(usernameSubmitSelector)
  console.log('Submitting username form...')

  await page.waitFor(passwordFieldSelector)

  console.log('Filling out password form...')
  await page.type(passwordFieldSelector, config.password)
  await page.waitFor(passwordSubmitSelector + ':enabled')
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
    const filePath = path.join(dataCacheDir, `${pageId}.json`)

    if (fs.existsSync(filePath)) {
      console.log(`Skipping #${i + 1} with page id: ${pageId} (File already exists: "${filePath}")`)

      fullData[pageId] = await fs.readJson(filePath)

      continue
    }

    // Navigate to download page for this message's attachments
    await page.goto(message.downloadPageUrl, {
      waitUntil: 'networkidle2',
      slowMo: 250
    })

    await page.waitFor('.att-msg-preview a[href^="/neo/groups/"][data-rapid_p], #yg-error-container')

    // Scrape each download page for filenames and download URLs
    try {
      const moreData = await page.evaluate(() => {
        /** @type NodeList */
        const thumbContexts = document.querySelectorAll('.thumb-desc-context')
        const messageLink = document.querySelector('.att-msg-preview a[href^="/neo/groups/"][data-rapid_p]')
        const messageId = messageLink ? messageLink.href.trim().split('/').pop() : null

        const files = [...thumbContexts].map(context => {
          const author = context.querySelector('.thumb-meta').textContent.trim()
          const downloadLink = context.querySelector('a[href^="https://xa.yimg.com/"]')
          const downloadUrl = downloadLink.href
          const qsIndex = downloadUrl.indexOf('?')

          const fileName = downloadUrl.substring(
            downloadUrl.lastIndexOf('/') + 1,
            qsIndex !== -1 ? qsIndex : undefined
          )

          return {
            fileName,
            author,
            downloadUrl
          }
        })

        return { messageId, files }
      })

      for (const file of moreData.files) {
        const pageDir = path.join(fileCacheDir, pageId)
        const to = path.join(pageDir, file.fileName)

        if (fs.existsSync(to)) {
          console.log(`File already cached ${file.downloadUrl} => ${to}`)
        } else {
          fs.ensureDirSync(pageDir)
          console.log(`Downloading ${file.downloadUrl} => ${to}`)
          file.localPath = to
          await download({
            file: file.downloadUrl,
            onPage: page,
            to
          })
        }
      }

      fullData[pageId] = { ...message, ...moreData, pageId }

      await fs.ensureDirSync(dataCacheDir);
      await fs.writeJson(filePath, fullData[pageId], ...jsonWriteArgs)
    } catch (exception) {
      const messageJson = JSON.stringify(message, null, 2)
      console.error(
        `Failed on message with page ID '${pageId}': ${messageJson}\n`,
        exception
      )
      ++failures
    }

    const percentage = ((i + 1) / count * 100).toFixed(2)
    console.log(`${percentage}% (${i + 1}/${count})`)
  }

  console.log('Closing browser...')
  await browser.close()

  console.log('Generating MessagesWithAttachments.json...')
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
