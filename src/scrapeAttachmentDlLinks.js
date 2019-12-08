const puppeteer = require('puppeteer')
const path = require('path')
const Scraper = require('./Scraper.js')

/** @type array */
const albums = require('../out/BareAlbums.json')
const messages = require('../out/BareMessages.json')
const config = require('../config/config.json')
const outDir = path.resolve(__dirname + `/../out`)
const dataCacheDir = path.join(outDir, 'cache', 'attachments', 'data')
const fileCacheDir = path.join(outDir, 'cache', 'attachments', 'files')
const albumCacheDir = path.join(outDir, 'cache', 'albums')
const attachmentOutputPath = path.join(outDir, `MessagesWithAttachments.json`)
const albumOutputPath = path.join(outDir, `AlbumsWithImages.json`)

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
  const scraper = new Scraper({ browser })

  await scraper.logIn(config.username, config.password)

  _('=======================================================')
  _('Scraping albums')
  _('=======================================================')
  await scraper.scrapeAlbums(albums, albumCacheDir, albumOutputPath)

  _('=======================================================')
  _('Scraping attachments')
  _('=======================================================')
  await scraper.scrapeAttachments(messages, dataCacheDir, fileCacheDir, attachmentOutputPath)

  _('Closing browser...')
  await browser.close()
})()
