const puppeteer = require('puppeteer')
const path = require('path')
const download = require('puppeteer-file-downloader').download
const Scraper = require('./Scraper.js')

/** @type array */
const albums = require('../out/Albums.json')
const messages = require('../out/BareMessages.json')
const config = require('../config/config.json')
const outDir = path.resolve(__dirname + `/../out`)
const dataCacheDir = path.join(outDir, 'cache', 'attachments', 'data')
const fileCacheDir = path.join(outDir, 'cache', 'attachments', 'files')
const outFilePath = path.join(outDir, `MessagesWithAttachments.json`)

const _ = (...messages) => console.log(...messages)

/* Use data from BareMessages.json as a starting point.
 *
 * Iterate over each message. Get download links for each attachment and save them as JSON.
 *
 * Provide your Yahoo account credentials via config/config.json.
 *
 * You can also use config.json to provide "headless" and "executablePath" options to puppeteer.
 */
;(async () => {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({...config, slowMo: 50})
  const scraper = new Scraper({ browser, download })

  _('Logging in...')

  await scraper.logIn(config.username, config.password)

  _('=======================================================')
  _('Scraping attachments.')
  _('=======================================================')
  await scraper.scrapeAttachments(messages, dataCacheDir, fileCacheDir, outFilePath)

  _('Closing browser...')
  await browser.close()
})()
