/**
 * @author Travis Van Couvering <travis@tvanc.com>
 * @date   12/7/2019
 */
const fs = require('fs-extra')
const path = require('path')
const download = require('puppeteer-file-downloader').download

/**
 *
 */
class Scraper {
  browser
  dataCacheDir
  fileCacheDir
  outFilePath

  jsonWriteArgs = [
    { spaces: 2 },
    err => {
      if (err) {
        throw err
      }
    }
  ]

  #page

  constructor ({ browser, dataCacheDir, fileCacheDir, outFilePath }) {
    this.browser = browser

    this.dataCacheDir = dataCacheDir
    this.fileCacheDir = fileCacheDir
    this.outFilePath = outFilePath
  }

  async scrapeAlbums (albums, albumCacheDir, jsonOutputPath) {
    const page = await this.getPage()
    const _ = (...messages) => console.log(...messages)
    const hydratedAlbums = []

    let failures = 0

    for (const album of albums) {
      const albumDir = path.join(albumCacheDir, album.albumId + '')
      const images = []

      fs.ensureDirSync(albumDir)

      for (const uri of album.imageUris) {
        try {
          const originalFileName = getFileName(uri)
          const imageId = uri.split('/')[7]
          const to = path.join(albumDir, imageId)

          if (fs.existsSync(to)) {
            _(`Found in cache: ${uri}`)
          } else {

            _(`Downloading ${uri} => ${to}`)
            await download({
              file: uri,
              onPage: page,
              to
            })
          }

          images.push({
            originalFileName,
            imageId,
            downloadUrl: uri,
            localPath: to
          })
        } catch (exception) {
          const albumJson = JSON.stringify(album, null, 2)
          console.error('-----------------------------------------------------')
          console.error(
            `Failed downloading ${uri} from album #${album.albumId}: ${albumJson}\n`,
            exception
          )
          console.error('-----------------------------------------------------')

          ++failures
        }
      }

      hydratedAlbums.push({
        name: album.name,
        albumId: album.albumId,
        images
      })
    }

    await fs.writeJson(jsonOutputPath, hydratedAlbums, ...this.jsonWriteArgs)

    return {
      albums: hydratedAlbums,
      failures,
    }
  }

  async scrapeAttachments (messages, dataCacheDir, fileCacheDir, outFilePath) {
    const page = await this.getPage()
    const _ = (...messages) => console.log(...messages)

    const fullData = {}
    const messageCount = messages.length

    let attachmentCount = 0
    let failureCount = 0

    // Each `email` contains a subject, author, date, file count, and url to a page
    // containing links to download the attached files
    for (let i = 0; i < messageCount; ++i) {
      const message = messages[i]
      const pageId = message.downloadPageUrl.split('/').pop()
      const filePath = path.join(dataCacheDir, `${pageId}.json`)

      if (fs.existsSync(filePath)) {
        _(`Skipping #${i + 1} with page id: ${pageId} (File already exists: "${filePath}")`)

        fullData[pageId] = await fs.readJson(filePath)

        continue
      }

      // Navigate to download page for this message's attachments
      await page.goto(message.downloadPageUrl, { waitUntil: 'networkidle2' })

      await page.waitFor('.att-msg-preview a[href^="/neo/groups/"][data-rapid_p], #yg-error-container')

      // Scrape each download page for filenames and download URLs
      try {
        const moreData = await page.evaluate(() => {
          /** @type NodeListOf<HTMLElement> */
          const thumbContexts = document.querySelectorAll('.thumb-desc-context')
          const messageLink = document.querySelector('.att-msg-preview a[href^="/neo/groups/"][data-rapid_p]')
          const messageId = messageLink ? messageLink.href.trim().split('/').pop() : null

          const files = [...thumbContexts].map(context => {
            const author = context.querySelector('.thumb-meta').textContent.trim()
            const downloadLink = context.querySelector('a[href^="https://xa.yimg.com/"]')
            const downloadUrl = downloadLink.href
            const fileName = getFileName(downloadUrl)

            return {
              fileName,
              author,
              downloadUrl
            }
          })

          function getFileName (uri) {
            const qsIndex = uri.indexOf('?')

            return decodeURIComponent(
              uri.substring(
                uri.lastIndexOf('/') + 1,
                qsIndex !== -1 ? qsIndex : undefined
              )
            )
          }

          return { messageId, files }
        })

        for (const file of moreData.files) {
          const pageDir = path.join(fileCacheDir, pageId)
          const to = path.join(pageDir, file.fileName)

          if (fs.existsSync(to)) {
            _(`Found in cache: ${file.downloadUrl}`)
          } else {
            fs.ensureDirSync(pageDir)
            file.localPath = to

            _(`Downloading ${file.downloadUrl} => ${to}`)
            await download({
              file: file.downloadUrl,
              onPage: page,
              to
            })
          }
        }

        fullData[pageId] = { ...message, ...moreData, pageId }

        await fs.ensureDirSync(dataCacheDir)
        await fs.writeJson(filePath, fullData[pageId], ...this.jsonWriteArgs)
      } catch (exception) {
        const messageJson = JSON.stringify(message, null, 2)
        console.error(
          `Failed on message with page ID '${pageId}': ${messageJson}\n`,
          exception
        )
        ++failureCount
      }

      const percentage = ((i + 1) / messageCount * 100).toFixed(2)
      _(`${percentage}% (${i + 1}/${messageCount})`)
    }

    _('Generating MessagesWithAttachments.json...')
    await fs.writeJson(outFilePath, fullData, ...this.jsonWriteArgs)

    _('')
    _('=======================================================')
    _('')
    _(`Completed with ${failureCount} failures.`)
    _('')
    _(`Downloaded ${attachmentCount} attachments for ${messageCount - failureCount}/${messageCount} messages.`)
    _('')
    _('Complete list of attachment-download links written to:')
    _(`${outFilePath}`)
    _('')
    _('=======================================================')
    _('')

    return {
      failureCount,
      messageCount,
      attachmentCount,
      fullData
    }
  }

  async logIn (username, password) {
    const usernameSubmitSelector = 'input[type="submit"][name="signin"]'
    const passwordSubmitSelector = 'button[type="submit"][name="verifyPassword"]'
    const usernameFieldSelector = 'input[name="username"]'
    const passwordFieldSelector = 'input[name="password"]'
    const page = await this.getPage()
    const _ = (...messages) => console.log(...messages)

    _('Navigating to login page...')
    await Promise.all([
      page.goto(
        'https://login.yahoo.com/config/login?done=https://groups.yahoo.com/neo',
        {
          waitUntil: 'networkidle0',
          slowMo: 250
        }
      ),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ])

    _('Submitting username...')
    await page.type(usernameFieldSelector, username)
    await page.waitFor(usernameSubmitSelector + ':enabled')
    await Promise.all([
      page.$eval(usernameSubmitSelector, button => button.click()),
      page.waitForNavigation()
    ])

    _('Submitting password...')
    await page.type(passwordFieldSelector, password)
    await page.waitFor(passwordSubmitSelector + ':enabled')
    await Promise.all([
      page.$eval(passwordSubmitSelector, button => button.click()),
      page.waitForNavigation()
    ])
  }

  async getPage () {
    if (this.#page === undefined) {
      this.#page = await this.browser.newPage()
    }

    return this.#page
  }
}

function getFileName (uri) {
  const qsIndex = uri.indexOf('?')

  return decodeURIComponent(
    uri.substring(
      uri.lastIndexOf('/') + 1,
      qsIndex !== -1 ? qsIndex : undefined
    )
  )
}

module.exports = Scraper

