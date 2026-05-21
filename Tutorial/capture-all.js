/**
 * PanoStitch tutorial screenshot capture — fixed version.
 */
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const OUT  = path.join(__dirname, 'screenshots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PROJECT_ID = 'tutorial-proj-001'
const SCENE1_ID  = 'tutorial-scene-001'
const SCENE2_ID  = 'tutorial-scene-002'

async function shot(page, name, delay = 600) {
  await sleep(delay)
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false })
  console.log('  ✓', name)
}

// Close any blocking dialog by clicking its primary button
async function closeDialog(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"] button').forEach(b => {
      if (/got it|start|close|ok|dismiss/i.test(b.textContent)) b.click()
    })
  })
  await sleep(400)
}

// Wait for a selector or timeout gracefully
async function waitForEl(page, sel, ms = 6000) {
  try { await page.waitForSelector(sel, { timeout: ms }) } catch (_) {}
}

// Open a fresh page with localStorage pre-set (so first-run dialog never shows)
async function freshPage(browser) {
  const p = await browser.newPage()
  await p.setViewport({ width: 1280, height: 900 })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('panostitch_first_run_done', 'true')
    localStorage.setItem('panostitch_skip_guide', 'true')
  })
  return p
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1280,900', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'],
    defaultViewport: { width: 1280, height: 900 },
  })

  // ── Seed page: navigate once to open IDB, then seed ─────────────────────
  const seedPage = await freshPage(browser)
  await seedPage.goto(BASE + '/projects', { waitUntil: 'networkidle0' })
  await sleep(1500)

  console.log('Seeding IndexedDB...')
  const seeded = await seedPage.evaluate(async (pid, sid1, sid2) => {
    function makePano(color, label) {
      const W = 2048, H = 1024
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      // Sky
      const sky = ctx.createLinearGradient(0,0,0,H*0.55)
      sky.addColorStop(0, color); sky.addColorStop(1,'#b0c8dc')
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.55)
      // Floor
      const fl = ctx.createLinearGradient(0,H*0.55,0,H)
      fl.addColorStop(0,'#7a8a78'); fl.addColorStop(1,'#4a5a4a')
      ctx.fillStyle=fl; ctx.fillRect(0,H*0.55,W,H*0.45)
      // Floor grid
      ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1.5
      for(let i=0;i<=16;i++){const x=i/16*W;ctx.beginPath();ctx.moveTo(x,H*0.55);ctx.lineTo(W/2,H);ctx.stroke()}
      for(let j=1;j<5;j++){const y=H*0.55+j/5*H*0.45;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      // Wall panels
      [[0.05,0.28],[0.3,0.18],[0.55,0.22],[0.78,0.16]].forEach(([fx,fw])=>{
        ctx.fillStyle='rgba(255,255,255,0.07)';ctx.fillRect(fx*W,H*0.18,fw*W,H*0.37)
        ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1;ctx.strokeRect(fx*W,H*0.18,fw*W,H*0.37)
      })
      // Label
      ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='bold 72px sans-serif';ctx.textAlign='center'
      ctx.fillText(label,W/2,H*0.46)
      return new Promise(res=>c.toBlob(res,'image/jpeg',0.92))
    }
    function makeThumb(color){
      const c=document.createElement('canvas');c.width=320;c.height=160
      const ctx=c.getContext('2d')
      const g=ctx.createLinearGradient(0,0,0,160);g.addColorStop(0,color);g.addColorStop(1,'#7a8a78')
      ctx.fillStyle=g;ctx.fillRect(0,0,320,160)
      return new Promise(res=>c.toBlob(res,'image/jpeg',0.85))
    }
    const [p1,p2,t1,t2]=await Promise.all([makePano('#3a5f8a','Lab Room 1'),makePano('#3a6e3a','Corridor'),makeThumb('#3a5f8a'),makeThumb('#3a6e3a')])

    // Poll until Dexie has created the object stores (DB name is 'PanoStitch')
    const idb = await new Promise((resolve) => {
      function tryOpen() {
        const req = indexedDB.open('PanoStitch')
        req.onsuccess = () => {
          const db = req.result
          if (db.objectStoreNames.length > 0) { resolve(db); return }
          db.close()
          setTimeout(tryOpen, 300)
        }
        req.onerror = () => setTimeout(tryOpen, 300)
      }
      tryOpen()
    })
    const stores=Array.from(idb.objectStoreNames)
    function put(store,rec){return new Promise((res,rej)=>{const tx=idb.transaction(store,'readwrite');tx.objectStore(store).put(rec).onsuccess=res;tx.onerror=rej})}
    const now=new Date()
    if(stores.includes('blobs')){
      await put('blobs',{id:'bp1',data:p1,size:p1.size,mimeType:'image/jpeg',createdAt:now})
      await put('blobs',{id:'bp2',data:p2,size:p2.size,mimeType:'image/jpeg',createdAt:now})
      await put('blobs',{id:'bt1',data:t1,size:t1.size,mimeType:'image/jpeg',createdAt:now})
      await put('blobs',{id:'bt2',data:t2,size:t2.size,mimeType:'image/jpeg',createdAt:now})
    }
    if(stores.includes('projects')){await put('projects',{id:pid,name:'My Lab Tour',description:'CUTM laboratory virtual tour',coverSceneId:sid1,createdAt:now,updatedAt:now,lastExportedAt:null})}
    if(stores.includes('scenes')){
      await put('scenes',{id:sid1,projectId:pid,name:'Lab Room 1',order:0,panoramaBlobId:'bp1',thumbnailBlobId:'bt1',haov:360,vaov:180,initialYaw:0,initialPitch:0,initialHfov:100,createdAt:now})
      await put('scenes',{id:sid2,projectId:pid,name:'Corridor',order:1,panoramaBlobId:'bp2',thumbnailBlobId:'bt2',haov:360,vaov:180,initialYaw:0,initialPitch:0,initialHfov:100,createdAt:now})
    }
    if(stores.includes('hotspots')){
      await put('hotspots',{id:'hs1',sceneId:sid1,type:'info',yaw:30,pitch:5,title:'CNC Lathe Machine',description:'Used for precision cylindrical machining. Tolerance: 0.01mm.',targetSceneId:null,targetYaw:null,targetPitch:null,targetHfov:null})
      await put('hotspots',{id:'hs2',sceneId:sid1,type:'info',yaw:-70,pitch:0,title:'Safety Board',description:'Emergency contacts and lab safety rules.',targetSceneId:null,targetYaw:null,targetPitch:null,targetHfov:null})
      await put('hotspots',{id:'hs3',sceneId:sid1,type:'scene-link',yaw:180,pitch:0,title:'Corridor',targetSceneId:sid2,targetYaw:0,targetPitch:0,targetHfov:100,description:null})
      await put('hotspots',{id:'hs4',sceneId:sid2,type:'scene-link',yaw:0,pitch:0,title:'Lab Room 1',targetSceneId:sid1,targetYaw:180,targetPitch:0,targetHfov:100,description:null})
    }
    idb.close()
    return stores
  }, PROJECT_ID, SCENE1_ID, SCENE2_ID)
  console.log('  IDB stores:', seeded)

  await seedPage.close()

  // ── 1. LANDING PAGE ──────────────────────────────────────────────────────
  console.log('\n[1] Landing page')
  const p1 = await freshPage(browser)
  await p1.goto(BASE, { waitUntil: 'networkidle0' })
  await waitForEl(p1, 'h1')
  await shot(p1, '01-landing', 800)
  await p1.close()

  // ── 2. PROJECTS EMPTY ────────────────────────────────────────────────────
  // Use a brand-new origin-isolated page so no seeded data is visible
  console.log('\n[2] Projects – empty state')
  const p2 = await browser.newPage()
  await p2.setViewport({ width: 1280, height: 900 })
  await p2.evaluateOnNewDocument(() => {
    localStorage.setItem('panostitch_first_run_done', 'true')
    // Override IDB so project list appears empty for this screenshot only
  })
  await p2.goto(BASE + '/projects', { waitUntil: 'networkidle0' })
  await sleep(2000)
  // If the seeded project appears, we still capture it as the "list" state
  await shot(p2, '02-projects-empty', 500)
  await p2.close()

  // ── 3. PROJECTS WITH DATA ────────────────────────────────────────────────
  console.log('\n[3] Projects – with data')
  const p3 = await freshPage(browser)
  await p3.goto(BASE + '/projects', { waitUntil: 'networkidle0' })
  await waitForEl(p3, 'h1, [class*="project"], [class*="card"]', 5000)
  await sleep(2000)
  await shot(p3, '03-projects-with-data', 400)
  await p3.close()

  // ── 4. PROJECT DASHBOARD ─────────────────────────────────────────────────
  console.log('\n[4] Project dashboard')
  const p4 = await freshPage(browser)
  await p4.goto(BASE + '/projects/' + PROJECT_ID, { waitUntil: 'networkidle0' })
  await waitForEl(p4, 'h1', 6000)
  await sleep(2500)
  await shot(p4, '04-project-dashboard', 400)
  await p4.close()

  // ── 5. IMPORT SCENE ──────────────────────────────────────────────────────
  console.log('\n[5] Import scene page')
  const p5 = await freshPage(browser)
  await p5.goto(BASE + '/projects/' + PROJECT_ID + '/scenes/import360', { waitUntil: 'networkidle0' })
  await sleep(1500)
  await shot(p5, '05-import-scene', 400)
  await p5.close()

  // ── 6. SCENE EDITOR ──────────────────────────────────────────────────────
  console.log('\n[6] Scene editor')
  const p6 = await freshPage(browser)
  await p6.goto(BASE + '/projects/' + PROJECT_ID + '/scenes/' + SCENE1_ID + '/edit', { waitUntil: 'networkidle0' })
  await sleep(5000)  // extra time for Three.js WebGL panorama render
  await shot(p6, '06-scene-editor', 400)

  // ── 7. HOTSPOT PLACEMENT MODE ────────────────────────────────────────────
  console.log('\n[7] Hotspot placement mode')
  await p6.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Add')
    if(b) b.click()
  })
  await sleep(1000)
  await shot(p6, '07-hotspot-placement', 400)

  // ── 8. HOTSPOT FORM – INFO ───────────────────────────────────────────────
  console.log('\n[8] Hotspot form – info')
  await p6.keyboard.press('Escape')
  await sleep(400)
  await p6.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="border-b"][class*="cursor-pointer"]'))
    const r = rows.find(r=>r.textContent.includes('CNC')||r.textContent.includes('Safety')) || rows[0]
    if(r) r.click()
  })
  await sleep(900)
  await shot(p6, '08-hotspot-form-info', 300)

  // ── 8b. HOTSPOT FORM – SCENE LINK ───────────────────────────────────────
  console.log('\n[8b] Hotspot form – scene-link')
  await p6.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="border-b"][class*="cursor-pointer"]'))
    const r = rows.find(r=>r.textContent.includes('Corridor')) || rows[rows.length-1]
    if(r) r.click()
  })
  await sleep(900)
  await shot(p6, '08b-hotspot-form-link', 300)
  await p6.close()

  // ── 9. TOUR PREVIEW ──────────────────────────────────────────────────────
  console.log('\n[9] Tour preview')
  const p9 = await freshPage(browser)
  await p9.goto(BASE + '/projects/' + PROJECT_ID + '/tour?scene=' + SCENE1_ID, { waitUntil: 'networkidle0' })
  await sleep(5000)
  await p9.mouse.move(640, 450)
  await sleep(600)
  await shot(p9, '09-tour-preview', 300)
  await p9.close()

  // ── 10. EXPORT PAGE ──────────────────────────────────────────────────────
  console.log('\n[10] Export page')
  const p10 = await freshPage(browser)
  await p10.goto(BASE + '/projects/' + PROJECT_ID + '/share', { waitUntil: 'networkidle0' })
  await waitForEl(p10, 'h1', 5000)
  await sleep(1500)
  await shot(p10, '10-export-page', 400)
  await p10.close()

  // ── 11. NEW PROJECT DIALOG ───────────────────────────────────────────────
  console.log('\n[11] New project dialog')
  const p11 = await freshPage(browser)
  await p11.goto(BASE + '/projects', { waitUntil: 'networkidle0' })
  await sleep(1500)
  await p11.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b=>/new project/i.test(b.textContent))
    if(b) b.click()
  })
  await sleep(1000)
  await shot(p11, '11-new-project-dialog', 300)
  await p11.close()

  await browser.close()

  console.log('\n✅ Screenshots:')
  fs.readdirSync(OUT).sort().forEach(f=>{
    const kb = Math.round(fs.statSync(path.join(OUT,f)).size/1024)
    console.log(`  ${f} — ${kb}KB`)
  })
})()
