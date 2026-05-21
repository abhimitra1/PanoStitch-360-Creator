const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const OUT = path.join(__dirname, 'screenshots')
const PROJECT_ID = 'demo-project-001'
const SCENE1_ID = 'demo-scene-001'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name) {
  await sleep(900)
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false })
  console.log('  ✓', name)
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1280,900', '--no-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // ── 7. Scene editor with "Add" placement mode ────────────────────────────
  console.log('\n[7] Scene editor + Add button')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/scenes/' + SCENE1_ID + '/edit', { waitUntil: 'networkidle0' })
  await sleep(2000)

  // Find the Add button by its text content
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const add = btns.find(b => b.textContent.trim() === 'Add')
    if (add) add.click()
  })
  await sleep(800)
  await shot(page, '07-hotspot-placement')

  // ── 8. Hotspot form – press Escape to exit placing, open existing row ────
  console.log('\n[8] Hotspot form (editing existing)')
  await page.keyboard.press('Escape')
  await sleep(400)

  // Click first hotspot row
  await page.evaluate(() => {
    const rows = document.querySelectorAll('[class*="cursor-pointer"]')
    for (const row of rows) {
      if (row.textContent.includes('CNC') || row.textContent.includes('Lathe') || row.textContent.includes('Corridor')) {
        row.click()
        break
      }
    }
  })
  await sleep(900)
  await shot(page, '08-hotspot-form-info')

  // ── 8b. Scene-link hotspot form ──────────────────────────────────────────
  console.log('\n[8b] Hotspot form (scene-link)')
  await page.evaluate(() => {
    const rows = document.querySelectorAll('[class*="cursor-pointer"]')
    for (const row of rows) {
      if (row.textContent.includes('Corridor') || row.textContent.includes('scene-link')) {
        row.click()
        break
      }
    }
    // try second row
    if (rows.length > 1) rows[1].click()
  })
  await sleep(900)
  await shot(page, '08b-hotspot-form-link')

  // ── 9. Tour preview ──────────────────────────────────────────────────────
  console.log('\n[9] Tour preview')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/tour?scene=' + SCENE1_ID, { waitUntil: 'networkidle0' })
  await sleep(3000)
  // move mouse to show overlay
  await page.mouse.move(640, 450)
  await sleep(400)
  await shot(page, '09-tour-preview')

  // ── 10. Export page ──────────────────────────────────────────────────────
  console.log('\n[10] Export page')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/share', { waitUntil: 'networkidle0' })
  await sleep(1200)
  await shot(page, '10-export-page')

  await browser.close()
  console.log('\n✅ Done. Screenshots:')
  console.log(fs.readdirSync(OUT).sort().map(f => '  ' + f).join('\n'))
})()
