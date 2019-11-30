/**
 * Run this in the browser console.
 *
 * Create a file at path out/Albums.json (relative to project root)
 * containing a single array as the root element.
 *
 * Repeat these steps for each album you see in:
 * https://groups.yahoo.com/neo/groups/<group name>/photos/albums
 *
 * Steps:
 * 1. Open the album
 * 2. Scroll to the bottom and keep scrolling until no more photos.
 * 3. Paste the full code below into your browser's dev-tools console.
 * 4. Append the generated JSON from the console to the root array in Albums.json
 */
(function getAlbumData () {
  const name = document.querySelector('.album-title').textContent.trim()
  const links = document.querySelectorAll('a[href^="https://xa.yimg.com/"][href$="download=1"]')
  const albumData = {
    name,
    fileUris: [...links].map(a => a.href),
  };

  return JSON.stringify(albumData, null, 2)
})()
