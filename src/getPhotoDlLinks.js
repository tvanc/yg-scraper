/**
 * Run this in the browser console.
 *
 * Repeat these steps for photostream:
 * https://groups.yahoo.com/neo/groups/<group name>/photos/photostream
 *
 * And from within each album you see in:
 * https://groups.yahoo.com/neo/groups/<group name>/photos/albums
 *
 * Steps:
 * 1. Scroll to the bottom and keep scrolling until no more photos.
 * 2. Paste the line below into your browser's dev-tools console.
 * 3. Save the JSON output.
 */
JSON.stringify([...document.querySelectorAll('a[href^="https://xa.yimg.com/"][href$="download=1"]')].map(a => a.href))
