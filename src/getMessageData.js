/**
 * For use in browser console. Just copy and paste the IIFE below into the browser
 * dev-tools console.
 *
 * Logs a big JSON string to the console containing attachment information scraped from
 * https://groups.yahoo.com/neo/groups/VanC-Pettes/attachments
 *
 * Information contains the URL of the page to visit to find download links for each
 * individual attachment, the subject of the email containing the attachment, the
 * author of that email, the date of the email (human formatted), and the number of files.
 *
 * Save the output into `out/Messages.json`
 *
 * Then, in terminal run
 * <pre>
 * node src/scrapeAttachmentDlLinks.js
 * </pre>
 *
 * This will populate your `out/attachments` dir with one JSON file per message. Each file
 * contains metadata about the message and `files` entry containing objects with the name
 * of the file and a download URI.
 *
 * Another (yet unwritten) script can then iterate over those files and download them.
 */
(function () {
  const rows = document.querySelectorAll('.files-row')
  const data = []

  rows.forEach(row => {
    const titleLink = row.querySelector('a[href^="/neo/groups/"]')
    const downloadPageUrl = titleLink.href
    const subject = titleLink.textContent.trim()
    const author = row.querySelector('.yg-list-auth').textContent.trim()
    const date = row.querySelector('.yg-list-date').textContent.trim()
    const fileCount = parseInt(row.querySelector('.files-list-count').textContent)

    data.push({
      subject,
      author,
      date,
      downloadPageUrl,
      fileCount
    })
  })

  console.log(JSON.stringify(data))
}())
