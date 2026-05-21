/**
 * Puppeteer script — captures PanoStitch UI screenshots for the tutorial.
 * Run from the Tutorial/ folder: node capture-screenshots.js
 * Requires the Next.js dev server on http://localhost:3000
 */

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const OUT = path.join(__dirname, 'screenshots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT)

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(page, name, selector) {
  await sleep(800)
  const el = selector ? await page.$(selector) : null
  if (el) {
    await el.screenshot({ path: path.join(OUT, name + '.png') })
  } else {
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false })
  }
  console.log('  ✓', name)
}

// Seed a demo project with 2 scenes + hotspots via IndexedDB / Dexie
const SEED_SCRIPT = `
(async () => {
  const { db } = await import('/src/lib/db/schema.ts').catch(() => ({}))
  // Use the global dexie instance if available
  // We'll use the app's own db via window after navigation
})()
`

// ---------- main ----------
;(async () => {
  const browser = await puppeteer.launch({
    headless: false,      // visible so WebGL/Three.js works
    args: [
      '--window-size=1280,900',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    defaultViewport: { width: 1280, height: 900 },
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // ── 1. Landing page ──────────────────────────────────────────────────────
  console.log('\n[1] Landing page')
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(1000)
  await shot(page, '01-landing')

  // ── 2. Projects list (empty) ─────────────────────────────────────────────
  console.log('\n[2] Projects page (empty)')
  await page.goto(BASE + '/projects', { waitUntil: 'networkidle0' })
  await sleep(1200)
  await shot(page, '02-projects-empty')

  // ── 3. Seed a demo project via browser console ───────────────────────────
  console.log('\n[3] Seeding demo project via Dexie...')
  const PROJECT_ID = 'demo-project-001'
  const SCENE1_ID = 'demo-scene-001'
  const SCENE2_ID = 'demo-scene-002'

  // Create a tiny 1×1 white placeholder blob as panorama
  const fakePanoBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k='

  await page.evaluate(
    async (pid, sid1, sid2, panoB64) => {
      // wait for Dexie db to be available on window (injected by the app)
      await new Promise((res) => setTimeout(res, 500))

      // Access the global Dexie db through the app bundle
      // The app exports `db` from lib/db/schema — we reach it via dynamic import
      // Since this is a Next.js app, we use the indexedDB API directly
      const DB_NAME = 'panostitch'
      const req = indexedDB.open(DB_NAME)

      await new Promise((resolve, reject) => {
        req.onsuccess = resolve
        req.onerror = reject
      })

      const idb = req.result
      const stores = Array.from(idb.objectStoreNames)
      console.log('IDB stores:', stores)

      const now = new Date().toISOString()

      // Helper to put a record
      function put(storeName, record) {
        return new Promise((res, rej) => {
          const tx = idb.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).put(record).onsuccess = res
          tx.onerror = rej
        })
      }

      // Create a fake blob record for panoramas
      // Use a small 2×1 equirectangular PNG (white)
      const binaryStr = atob(panoB64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/jpeg' })

      const PANO_BLOB_ID1 = 'blob-pano-001'
      const PANO_BLOB_ID2 = 'blob-pano-002'
      const THUMB_BLOB_ID1 = 'blob-thumb-001'
      const THUMB_BLOB_ID2 = 'blob-thumb-002'

      if (stores.includes('blobs')) {
        await put('blobs', { id: PANO_BLOB_ID1, data: blob, size: blob.size, mimeType: 'image/jpeg' })
        await put('blobs', { id: PANO_BLOB_ID2, data: blob, size: blob.size, mimeType: 'image/jpeg' })
        await put('blobs', { id: THUMB_BLOB_ID1, data: blob, size: blob.size, mimeType: 'image/jpeg' })
        await put('blobs', { id: THUMB_BLOB_ID2, data: blob, size: blob.size, mimeType: 'image/jpeg' })
      }

      if (stores.includes('projects')) {
        await put('projects', {
          id: pid,
          name: 'My Lab Tour',
          description: 'CUTM laboratory virtual tour',
          coverSceneId: sid1,
          createdAt: new Date(now),
          updatedAt: new Date(now),
          lastExportedAt: null,
        })
      }

      if (stores.includes('scenes')) {
        await put('scenes', {
          id: sid1, projectId: pid, name: 'Lab Room 1',
          order: 0,
          panoramaBlobId: PANO_BLOB_ID1,
          thumbnailBlobId: THUMB_BLOB_ID1,
          haov: 360, vaov: 180,
          initialYaw: 0, initialPitch: 0, initialHfov: 100,
          createdAt: new Date(now),
        })
        await put('scenes', {
          id: sid2, projectId: pid, name: 'Corridor',
          order: 1,
          panoramaBlobId: PANO_BLOB_ID2,
          thumbnailBlobId: THUMB_BLOB_ID2,
          haov: 360, vaov: 180,
          initialYaw: 0, initialPitch: 0, initialHfov: 100,
          createdAt: new Date(now),
        })
      }

      if (stores.includes('hotspots')) {
        await put('hotspots', {
          id: 'hs-001', sceneId: sid1, type: 'info',
          yaw: 45, pitch: 5,
          title: 'CNC Lathe Machine',
          description: 'Used for cylindrical machining operations.',
          targetSceneId: null, targetYaw: null, targetPitch: null, targetHfov: null,
        })
        await put('hotspots', {
          id: 'hs-002', sceneId: sid1, type: 'scene-link',
          yaw: 180, pitch: 0,
          title: 'Corridor',
          targetSceneId: sid2, targetYaw: 0, targetPitch: 0, targetHfov: 100,
          description: null,
        })
        await put('hotspots', {
          id: 'hs-003', sceneId: sid2, type: 'scene-link',
          yaw: 180, pitch: 0,
          title: 'Lab Room 1',
          targetSceneId: sid1, targetYaw: 0, targetPitch: 0, targetHfov: 100,
          description: null,
        })
      }

      idb.close()
      console.log('Seed complete')
    },
    PROJECT_ID, SCENE1_ID, SCENE2_ID, fakePanoBase64
  )

  // Reload to pick up seeded data
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(1500)
  await shot(page, '03-projects-list')

  // ── 4. Project dashboard ─────────────────────────────────────────────────
  console.log('\n[4] Project dashboard')
  await page.goto(BASE + '/projects/' + PROJECT_ID, { waitUntil: 'networkidle0' })
  await sleep(1500)
  await shot(page, '04-project-dashboard')

  // ── 5. Import scene page ─────────────────────────────────────────────────
  console.log('\n[5] Import scene page')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/scenes/import360', { waitUntil: 'networkidle0' })
  await sleep(1200)
  await shot(page, '05-import-scene')

  // ── 6. Scene editor – full view ──────────────────────────────────────────
  console.log('\n[6] Scene editor')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/scenes/' + SCENE1_ID + '/edit', { waitUntil: 'networkidle0' })
  await sleep(2500)
  await shot(page, '06-scene-editor')

  // ── 7. Hotspot panel – click Add to show placement mode ──────────────────
  console.log('\n[7] Hotspot panel / Add button')
  // Click Add button
  const addBtn = await page.$('button:has-text("Add"), button[title*="Add"]')
  if (addBtn) {
    await addBtn.click()
    await sleep(800)
  }
  await shot(page, '07-hotspot-placement')

  // ── 8. Hotspot form – escape placement, click existing hotspot ───────────
  console.log('\n[8] Hotspot form (info type)')
  await page.keyboard.press('Escape')
  await sleep(400)
  // Click the first hotspot row to open editor
  const hsRow = await page.$('.border-b.border-line.cursor-pointer')
  if (hsRow) {
    await hsRow.click()
    await sleep(800)
  }
  await shot(page, '08-hotspot-form')

  // ── 9. Tour preview ──────────────────────────────────────────────────────
  console.log('\n[9] Tour preview')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/tour', { waitUntil: 'networkidle0' })
  await sleep(2500)
  await shot(page, '09-tour-preview')

  // ── 10. Export / Share page ──────────────────────────────────────────────
  console.log('\n[10] Export page')
  await page.goto(BASE + '/projects/' + PROJECT_ID + '/share', { waitUntil: 'networkidle0' })
  await sleep(1200)
  await shot(page, '10-export-page')

  await browser.close()

  console.log('\n✅ All screenshots saved to Tutorial/screenshots/')
  console.log(fs.readdirSync(OUT).map(f => '  ' + f).join('\n'))
})()
