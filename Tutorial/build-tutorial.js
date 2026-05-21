const fs = require('fs')
const path = require('path')

function b64(file) {
  return fs.readFileSync(path.join(__dirname, file)).toString('base64')
}
function img(file, alt) {
  const ext = file.endsWith('.png') ? 'png' : 'jpeg'
  return `<img src="data:image/${ext};base64,${b64(file)}" alt="${alt}"/>`
}
function sc(file, label, alt) {
  return `<div class="sc-card">${img(file, alt)}<div class="sc-lbl">${label}</div></div>`
}
function scRow(cards) {
  return `<div class="screenshots">${cards.join('')}</div>`
}
function scWide(file, label, alt) {
  return `<div class="sc-card-wide">${img(file, alt)}<div class="sc-lbl">${label}</div></div>`
}

const imgAndroid = b64('image.png')
const imgIOS     = b64('image copy.png')
const S = 'screenshots/'

const panoSVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2" fill="none"/><rect x="2" y="30.4" width="60" height="3.2" fill="#d97757"/><circle cx="32" cy="32" r="1.4" fill="currentColor"/></svg>`

function hd(section) {
  return `<div class="page-header"><div class="ph-brand">${panoSVG}<span class="ph-name">PanoStitch</span></div><span class="ph-sec">${section}</span></div>`
}
function ft(n) {
  return `<div class="page-footer"><span class="pf-txt">PanoStitch Beginner&rsquo;s Guide &middot; panostitch.vercel.app</span><span class="pf-txt">Page ${n}</span></div>`
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--ink:#1a1816;--dim:#5a564f;--faint:#9a9590;--accent:#d97757;--al:#f5e9e3;--bg:#fafaf8;--sf:#f2f0ec;--ln:#e4e0d8;--ok:#2d7a4f;--bl:#2563eb;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Space Grotesk',system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.6;}
@page{size:A4;margin:0;}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
@media print{body{background:#fff;}.page{page-break-after:always;box-shadow:none!important;}.page:last-child{page-break-after:avoid;}.no-print{display:none!important;}}
.doc{max-width:794px;margin:0 auto;padding:24px 16px;}
.page{width:794px;min-height:1123px;background:#fff;margin:0 auto 32px;box-shadow:0 2px 24px rgba(0,0,0,.08);position:relative;overflow:hidden;display:flex;flex-direction:column;}
.cover{background:var(--ink);color:#fff;padding:72px 64px 52px;flex:1;}
.clogos{display:flex;align-items:center;gap:18px;margin-bottom:64px;}
.cdivider{width:1px;height:36px;background:rgba(255,255,255,.18);}
.cbrand{display:flex;flex-direction:column;gap:3px;}
.cbrand-name{font-size:15px;font-weight:700;color:#f5f0e6;letter-spacing:.02em;}
.cbrand-sub{font-family:'JetBrains Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:rgba(245,240,230,.38);}
.ceyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:var(--accent);margin-bottom:16px;}
.ctitle{font-size:48px;font-weight:700;line-height:1.06;color:#f5f0e6;margin-bottom:18px;}
.ctitle span{color:var(--accent);}
.csub{font-size:16px;font-weight:400;color:rgba(245,240,230,.58);max-width:460px;line-height:1.65;margin-bottom:52px;}
.ctoc{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ctoc-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:10px 14px;}
.ctoc-num{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--accent);min-width:22px;}
.ctoc-lbl{font-size:12px;color:rgba(245,240,230,.68);font-weight:500;}
.cfooter{border-top:1px solid rgba(255,255,255,.07);padding:14px 64px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.18);}
.cfooter-txt{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(245,240,230,.25);}
.page-header{padding:16px 48px;border-bottom:1px solid var(--ln);display:flex;align-items:center;justify-content:space-between;}
.ph-brand{display:flex;align-items:center;gap:7px;}
.ph-brand svg{width:18px;height:18px;color:var(--dim);}
.ph-name{font-size:11px;font-weight:600;color:var(--dim);letter-spacing:.04em;}
.ph-sec{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:var(--faint);}
.page-footer{padding:11px 48px;border-top:1px solid var(--ln);display:flex;align-items:center;justify-content:space-between;}
.pf-txt{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);}
.page-content{padding:28px 48px;flex:1;}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--accent);margin-bottom:7px;}
.sec-title{font-size:22px;font-weight:700;color:var(--ink);margin-bottom:20px;line-height:1.2;}
.step{display:flex;gap:16px;margin-bottom:18px;}
.snum{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px;}
.sbody{flex:1;}
.stitle{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px;line-height:1.3;}
.sdesc{font-size:12px;color:var(--dim);line-height:1.6;}
.snote{margin-top:7px;background:var(--al);border-left:3px solid var(--accent);border-radius:0 4px 4px 0;padding:7px 11px;font-size:11px;color:var(--dim);line-height:1.5;}
.stip{margin-top:7px;background:#e8f5ee;border-left:3px solid var(--ok);border-radius:0 4px 4px 0;padding:7px 11px;font-size:11px;color:#1a4a30;line-height:1.5;}
.stip strong,.snote strong{font-weight:600;}
.sdivider{border:none;border-top:1px solid var(--ln);margin:18px 0;}
.badges{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;}
.badge{display:flex;align-items:center;gap:10px;border:1.5px solid var(--ln);border-radius:8px;padding:8px 14px;text-decoration:none;color:var(--ink);background:var(--sf);}
.badge-icon{font-size:20px;line-height:1;}
.badge-sub{font-size:9px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;}
.badge-name{font-size:13px;font-weight:700;}
.screenshots{display:flex;gap:12px;margin:12px 0;align-items:flex-start;}
.sc-card{flex:1;border:1px solid var(--ln);border-radius:6px;overflow:hidden;background:#fff;}
.sc-card img{width:100%;display:block;}
.sc-lbl{padding:5px 8px;font-size:10px;font-weight:600;color:var(--dim);border-top:1px solid var(--ln);text-align:center;background:var(--sf);}
.sc-card-wide{border:1px solid var(--ln);border-radius:6px;overflow:hidden;background:#fff;margin:12px 0;}
.sc-card-wide img{width:100%;display:block;}
.sc-card-wide .sc-lbl{padding:5px 8px;font-size:10px;font-weight:600;color:var(--dim);border-top:1px solid var(--ln);text-align:center;background:var(--sf);}
.url{display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:10px;background:var(--sf);border:1px solid var(--ln);border-radius:4px;padding:3px 8px;color:var(--bl);margin-top:5px;word-break:break-all;}
.mgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}
.mcard{border:1px solid var(--ln);border-radius:8px;padding:12px;background:var(--sf);}
.mplat{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:var(--accent);margin-bottom:4px;}
.mtitle{font-size:12px;font-weight:700;margin-bottom:5px;}
.mdesc{font-size:11px;color:var(--dim);line-height:1.5;}
.mdesc ol{padding-left:15px;}
.mdesc li{margin-top:2px;}
.hstypes{display:flex;gap:12px;margin:12px 0;}
.hst{flex:1;border-radius:8px;padding:12px;border:1px solid var(--ln);}
.hst-arrow{background:#fff5f2;border-color:#f5c5b2;}
.hst-info{background:#eff3ff;border-color:#b2c5f5;}
.hsbadge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:7px;font-size:14px;}
.hsbadge-a{background:var(--accent);color:#fff;}
.hsbadge-i{background:var(--bl);color:#fff;font-style:italic;font-family:Georgia,serif;}
.hst-title{font-size:12px;font-weight:700;margin-bottom:3px;}
.hst-desc{font-size:11px;color:var(--dim);line-height:1.5;}
.flow{display:flex;margin:12px 0;align-items:stretch;}
.fi{flex:1;text-align:center;padding:8px 4px;position:relative;}
.fi::after{content:'→';position:absolute;right:-6px;top:50%;transform:translateY(-50%);color:var(--faint);font-size:12px;}
.fi:last-child::after{display:none;}
.fc{width:32px;height:32px;border-radius:50%;background:var(--ink);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;}
.fl{font-size:10px;color:var(--dim);font-weight:600;}
.callout{background:var(--sf);border:1px solid var(--ln);border-radius:8px;padding:10px 12px;margin-top:10px;display:flex;align-items:flex-start;gap:10px;}
.callout-icon{width:24px;height:24px;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.callout-txt{font-size:11.5px;color:var(--dim);line-height:1.55;}
.callout-txt strong{color:var(--ink);}
.warn{background:#fffbea;border:1px solid #f5e070;border-radius:6px;padding:9px 12px;font-size:11px;color:#7a5c00;line-height:1.5;margin-top:8px;}
.tag{display:inline-block;background:var(--al);color:var(--accent);font-size:8px;font-weight:600;padding:2px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.07em;margin-left:4px;}
.tag-b{background:#eff3ff;color:var(--bl);}
.print-btn{position:fixed;bottom:24px;right:24px;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Space Grotesk',sans-serif;box-shadow:0 4px 16px rgba(217,119,87,.4);z-index:100;}
.print-btn:hover{background:#c46840;}
`

const parts = []

parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>PanoStitch &#8212; Complete Beginner&#8217;s Guide</title>
<style>${CSS}</style>
</head>
<body>
<div class="doc">

<!-- COVER -->
<div class="page">
  <div class="cover">
    <div class="clogos">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="height:44px;width:44px">
        <circle cx="32" cy="32" r="22" stroke="#f5f0e6" stroke-width="2" fill="none"/>
        <rect x="2" y="30.4" width="60" height="3.2" fill="#d97757"/>
        <circle cx="32" cy="32" r="1.4" fill="#f5f0e6"/>
      </svg>
      <div class="cbrand">
        <div class="cbrand-name">PanoStitch</div>
        <div class="cbrand-sub">360&deg; Virtual Tours</div>
      </div>
      <div class="cdivider"></div>
      <div class="cbrand">
        <div class="cbrand-name" style="font-size:13px">Centurion University of Technology &amp; Management</div>
        <div class="cbrand-sub">CUTM &middot; panostitch.vercel.app</div>
      </div>
    </div>
    <p class="ceyebrow">Official User Guide</p>
    <h1 class="ctitle">Build Your First<br/><span>360&deg; Virtual Tour</span></h1>
    <p class="csub">A complete step-by-step guide for beginners &mdash; from capturing photos on your phone to publishing an interactive virtual tour entirely in your browser.</p>
    <div class="ctoc">
      <div class="ctoc-item"><span class="ctoc-num">01</span><span class="ctoc-lbl">Download the 360&deg; Camera App</span></div>
      <div class="ctoc-item"><span class="ctoc-num">02</span><span class="ctoc-lbl">Capture 360&deg; Photos in Any Room</span></div>
      <div class="ctoc-item"><span class="ctoc-num">03</span><span class="ctoc-lbl">Transfer Photos to Your Computer</span></div>
      <div class="ctoc-item"><span class="ctoc-num">04</span><span class="ctoc-lbl">Create a Project &amp; Import Scenes</span></div>
      <div class="ctoc-item"><span class="ctoc-num">05</span><span class="ctoc-lbl">Add Info &amp; Navigation Hotspots</span></div>
      <div class="ctoc-item"><span class="ctoc-num">06</span><span class="ctoc-lbl">Preview, Export &amp; Share as HTML</span></div>
    </div>
  </div>
  <div class="cfooter">
    <span class="cfooter-txt">PanoStitch &middot; 100% Browser-Based &middot; No Account Required &middot; All Data Stays On Your Device</span>
    <span class="cfooter-txt">panostitch.vercel.app</span>
  </div>
</div>`)

parts.push(`
<!-- PAGE 1: Download App -->
<div class="page">
  ${hd('Section 01 &mdash; Install the 360&deg; Camera App')}
  <div class="page-content">
    <p class="eyebrow">Step 01 of 06</p>
    <h2 class="sec-title">Download the 360&deg; Camera App</h2>
    <div class="step">
      <div class="snum">1</div>
      <div class="sbody">
        <p class="stitle">Open the App Store (iPhone) or Google Play (Android) on your phone</p>
        <p class="sdesc">Search for <strong>&ldquo;360 Photo Cam&rdquo;</strong> by DoSpace, or use the links below. The app is free. Tap <strong>Install</strong> or <strong>Get</strong> and wait for it to finish.</p>
        <div class="badges">
          <a class="badge" href="https://apps.apple.com/in/app/360-photo-cam/id6470239030">
            <span class="badge-icon">&#xf8ff;</span>
            <span><div class="badge-sub">Download on the</div><div class="badge-name">App Store</div></span>
          </a>
          <a class="badge" href="https://play.google.com/store/apps/details?id=com.dospace.photo360">
            <span class="badge-icon">&#9654;</span>
            <span><div class="badge-sub">Get it on</div><div class="badge-name">Google Play</div></span>
          </a>
        </div>
        <div class="url">iOS: https://apps.apple.com/in/app/360-photo-cam/id6470239030</div><br/>
        <div class="url">Android: https://play.google.com/store/apps/details?id=com.dospace.photo360</div>
      </div>
    </div>
    <div class="screenshots">
      <div class="sc-card">
        <img src="data:image/png;base64,${imgIOS}" alt="App Store screenshot"/>
        <div class="sc-lbl">&#xf8ff; iOS &mdash; App Store</div>
      </div>
      <div class="sc-card">
        <img src="data:image/png;base64,${imgAndroid}" alt="Google Play screenshot"/>
        <div class="sc-lbl">&#9654; Android &mdash; Google Play &middot; 4.8&#9733; &middot; 100K+ Downloads</div>
      </div>
    </div>
    <div class="stip"><strong>Note:</strong> You only need the <strong>free version</strong>. All 360&deg; capture features are included at no cost. Ignore optional in-app purchases.</div>
  </div>
  ${ft(1)}
</div>`)

parts.push(`
<!-- PAGE 2: Capture Photos -->
<div class="page">
  ${hd('Section 02 &mdash; Capture 360&deg; Photos')}
  <div class="page-content">
    <p class="eyebrow">Step 02 of 06</p>
    <h2 class="sec-title">Capture 360&deg; Photos with Your Phone</h2>
    <div class="step">
      <div class="snum">2</div>
      <div class="sbody">
        <p class="stitle">Go to the room and stand in the centre</p>
        <p class="sdesc">Walk to the middle of the room you want to capture. Stand roughly in the centre. Make sure the lighting is adequate &mdash; natural light or overhead lights should be on. Avoid direct sunlight shining into the lens.</p>
      </div>
    </div>
    <div class="step">
      <div class="snum">3</div>
      <div class="sbody">
        <p class="stitle">Open 360 Photo Cam and start a new capture</p>
        <p class="sdesc">Open the app and tap the large <strong>Capture</strong> button. The app shows a sphere guide with highlighted zones. Hold your phone vertically (portrait mode) at about chest height.</p>
        <div class="stip"><strong>Keep your feet in one spot.</strong> Rotate your whole body slowly &mdash; do not walk around while capturing. Moving your feet mid-capture causes stitching errors.</div>
      </div>
    </div>
    <div class="step">
      <div class="snum">4</div>
      <div class="sbody">
        <p class="stitle">Follow the on-screen guide to fill all zones</p>
        <p class="sdesc">Slowly rotate your body and tilt your phone to point at each highlighted zone. The zone turns green when captured. Take your time &mdash; rushing causes blur or gaps. Do not skip any zone.</p>
        <div class="snote"><strong>Important:</strong> Complete <em>all</em> highlighted zones. A missing zone creates a black hole in the panorama that cannot be fixed later.</div>
      </div>
    </div>
    <div class="step">
      <div class="snum">5</div>
      <div class="sbody">
        <p class="stitle">Wait for stitching, then save</p>
        <p class="sdesc">Once all zones are filled, the app stitches automatically (10&ndash;30 seconds). Tap <strong>Save</strong> to save the panorama to your Photos (iOS) or Gallery (Android).</p>
        <div class="stip"><strong>Quality tip:</strong> Always save at the <strong>highest resolution</strong> available. Never resize or compress before importing into PanoStitch.</div>
      </div>
    </div>
    <div class="step">
      <div class="snum">6</div>
      <div class="sbody">
        <p class="stitle">Repeat for every room in your tour</p>
        <p class="sdesc">Go to the next room and repeat steps 2&ndash;5. Capture one panorama per space &mdash; Lab, Corridor, Reception, etc. Each panorama becomes one <strong>scene</strong> in PanoStitch.</p>
      </div>
    </div>
    <div class="warn">&#9888; <strong>Common mistakes:</strong> Moving people cause ghosting. Spinning too fast causes blur. Always use portrait mode &mdash; shooting in landscape (horizontal) may produce incorrect output.</div>
  </div>
  ${ft(2)}
</div>`)

parts.push(`
<!-- PAGE 3: Transfer Photos -->
<div class="page">
  ${hd('Section 03 &mdash; Transfer Photos to Computer')}
  <div class="page-content">
    <p class="eyebrow">Step 03 of 06</p>
    <h2 class="sec-title">Transfer Full-Resolution Photos to Your Computer</h2>
    <p class="sdesc" style="margin-bottom:14px">PanoStitch runs in your web browser. To import panoramas, the image files must be on your computer first. Choose the method that matches your phone.</p>
    <div class="mgrid">
      <div class="mcard">
        <div class="mplat">&#xf8ff; iPhone / iPad &mdash; Recommended</div>
        <div class="mtitle">USB Cable</div>
        <div class="mdesc"><ol>
          <li>Connect your iPhone to the computer via Lightning or USB-C cable.</li>
          <li>Tap <strong>Trust This Computer</strong> on iPhone and enter your passcode.</li>
          <li><strong>Mac:</strong> Finder &rarr; iPhone sidebar &rarr; Photos tab &rarr; drag panoramas to Desktop.</li>
          <li><strong>Windows:</strong> File Explorer &rarr; This PC &rarr; Apple iPhone &rarr; DCIM &rarr; copy to Desktop.</li>
        </ol></div>
      </div>
      <div class="mcard">
        <div class="mplat">&#xf8ff; iPhone / iPad &mdash; Mac Only</div>
        <div class="mtitle">AirDrop</div>
        <div class="mdesc"><ol>
          <li>On Mac, open Finder &rarr; AirDrop. Set &ldquo;Allow discovery by: Everyone&rdquo;.</li>
          <li>On iPhone, open <strong>Photos</strong>, select all panoramas.</li>
          <li>Tap Share &rarr; AirDrop &rarr; tap your Mac name.</li>
          <li>Files arrive at full resolution in <strong>Downloads</strong>.</li>
        </ol></div>
      </div>
      <div class="mcard">
        <div class="mplat">Android &mdash; Recommended</div>
        <div class="mtitle">USB Cable</div>
        <div class="mdesc"><ol>
          <li>Connect Android phone to computer via USB cable.</li>
          <li>Swipe down notification shade &rarr; tap USB notification &rarr; choose <strong>File Transfer</strong>.</li>
          <li>File Explorer &rarr; your phone &rarr; Internal Storage &rarr; DCIM &rarr; Camera.</li>
          <li>Copy panorama files to Desktop.</li>
        </ol></div>
      </div>
      <div class="mcard">
        <div class="mplat">Android &mdash; Wi-Fi Option</div>
        <div class="mtitle">Google Photos</div>
        <div class="mdesc"><ol>
          <li>Ensure <strong>Google Photos</strong> backup is enabled on your Android.</li>
          <li>On computer, open <strong>photos.google.com</strong> and sign in.</li>
          <li>Find the panorama &rarr; three-dot menu &rarr; <strong>Download</strong>.</li>
          <li>Full-resolution file saves to Downloads.</li>
        </ol></div>
      </div>
    </div>
    <div class="stip" style="margin-top:12px"><strong>Quality check:</strong> Right-click the file &rarr; Properties (Windows) or Get Info (Mac). Confirm dimensions are at least <strong>4000 &times; 2000 pixels</strong>. Smaller files will appear blurry.</div>
    <div class="snote" style="margin-top:8px"><strong>Accepted formats:</strong> JPG and PNG. The 360 Photo Cam app saves JPG by default. Do not convert or compress before importing.</div>
  </div>
  ${ft(3)}
</div>`)

parts.push(`
<!-- PAGE 4: Create Project & Scenes -->
<div class="page">
  ${hd('Section 04 &mdash; Create a Project &amp; Import Scenes')}
  <div class="page-content">
    <p class="eyebrow">Step 04 of 06</p>
    <h2 class="sec-title">Create a Project &amp; Import Your Scenes</h2>
    <div class="step">
      <div class="snum">7</div>
      <div class="sbody">
        <p class="stitle">Open PanoStitch in your web browser</p>
        <p class="sdesc">On your computer, open <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. Go to the address below. The app loads instantly &mdash; no installation, no account needed.</p>
        <div class="url">&#127760; https://panostitch.vercel.app</div>
        <div class="stip" style="margin-top:7px"><strong>All data stays on your computer.</strong> PanoStitch stores everything in your browser. Your photos are never uploaded to any server.</div>
      </div>
    </div>
    <div class="step">
      <div class="snum">8</div>
      <div class="sbody">
        <p class="stitle">Click <strong>+ New Project</strong> and name your tour</p>
        <p class="sdesc">On the Projects page click <strong>+ New Project</strong>. Type a name like <em>&ldquo;My Lab Tour&rdquo;</em> and click <strong>Create</strong>. You are taken to the project dashboard.</p>
      </div>
    </div>
    ${scRow([
      sc(S + '11-new-project-dialog.png', '+ New Project dialog', 'New project dialog'),
      sc(S + '04-project-dashboard.png', 'Project dashboard with scenes', 'Project dashboard')
    ])}
    <div class="step">
      <div class="snum">9</div>
      <div class="sbody">
        <p class="stitle">Import each 360&deg; scene from your computer</p>
        <p class="sdesc">Click <strong>Import 360&deg; Scene</strong>. A file picker opens &mdash; select the panorama file from your Desktop. Give the scene a clear name like <em>&ldquo;Lab Room 1&rdquo;</em>. Repeat for each room.</p>
        <div class="snote"><strong>Wait:</strong> Large files (8 MB+) take 10&ndash;20 seconds to process. Wait for the scene card to appear before importing the next scene. Do not close the browser tab.</div>
      </div>
    </div>
    ${scWide(S + '05-import-scene.png', 'Import 360&deg; Scene page &mdash; select the panorama file and name the scene', 'Import scene page')}
  </div>
  ${ft(4)}
</div>`)

parts.push(`
<!-- PAGE 5: Hotspots -->
<div class="page">
  ${hd('Section 05 &mdash; Add Info &amp; Navigation Hotspots')}
  <div class="page-content">
    <p class="eyebrow">Step 05 of 06</p>
    <h2 class="sec-title">Add Hotspots &mdash; Info Labels &amp; Navigation Links</h2>
    <div class="hstypes">
      <div class="hst hst-arrow">
        <div class="hsbadge hsbadge-a">&#8250;</div>
        <div class="hst-title">Scene Link <span class="tag">Navigation</span></div>
        <div class="hst-desc">A clickable arrow that takes the visitor to another scene. Place these at doorways and corridors to connect rooms together.</div>
      </div>
      <div class="hst hst-info">
        <div class="hsbadge hsbadge-i"><em>i</em></div>
        <div class="hst-title">Info Hotspot <span class="tag tag-b">Label</span></div>
        <div class="hst-desc">A floating label with a title and description. The title is always visible in the tour. Clicking it shows the full details card.</div>
      </div>
    </div>
    <div class="step" style="margin-top:12px">
      <div class="snum">10</div>
      <div class="sbody">
        <p class="stitle">Open a scene for editing</p>
        <p class="sdesc">On the project dashboard, click any scene card. The panorama fills the screen. The Hotspots panel is on the right side (desktop) or bottom (mobile).</p>
      </div>
    </div>
    <div class="step">
      <div class="snum">11</div>
      <div class="sbody">
        <p class="stitle">Click <strong>+ Add</strong>, then click anywhere on the panorama</p>
        <p class="sdesc">Click <strong>+ Add</strong> in the Hotspots panel. The cursor becomes a crosshair. Click the object or doorway. Choose <strong>Info</strong> or <strong>Scene Link</strong>, fill in the title, click <strong>Save</strong>.</p>
        <div class="stip"><strong>Scene Links:</strong> Pick the target scene from the dropdown. Tick <strong>Add return hotspot</strong> to automatically add a back-arrow in the other scene &mdash; saves time.</div>
      </div>
    </div>
    ${scRow([
      sc(S + '06-scene-editor.png', 'Scene editor &mdash; panorama viewer with hotspot panel', 'Scene editor'),
      sc(S + '07-hotspot-placement.png', 'Placement mode &mdash; click panorama to drop hotspot', 'Hotspot placement')
    ])}
    ${scRow([
      sc(S + '08-hotspot-form-info.png', 'Info hotspot form &mdash; title + description', 'Info hotspot form'),
      sc(S + '08b-hotspot-form-link.png', 'Scene Link form &mdash; select target scene', 'Scene link form')
    ])}
  </div>
  ${ft(5)}
</div>`)

parts.push(`
<!-- PAGE 6: Export -->
<div class="page">
  ${hd('Section 06 &mdash; Preview, Save &amp; Export')}
  <div class="page-content">
    <p class="eyebrow">Step 06 of 06</p>
    <h2 class="sec-title">Preview, Save &amp; Export Your Tour as HTML</h2>
    <div class="step">
      <div class="snum">12</div>
      <div class="sbody">
        <p class="stitle">Preview the complete tour</p>
        <p class="sdesc">From the project dashboard click <strong>Preview Tour</strong>. Walk through all scenes using hotspot arrows. Test all info labels. Use the bottom scene strip to jump to any scene. Use arrow keys on desktop or swipe on mobile.</p>
        <div class="stip"><strong>Mobile preview:</strong> Tap the gyroscope button (circle icon) to track the panorama using your phone&rsquo;s sensors &mdash; tilt and rotate the phone to look around naturally.</div>
      </div>
    </div>
    ${scWide(S + '09-tour-preview.png', 'Tour preview &mdash; fullscreen 360&deg; viewer with scene strip and info hotspots', 'Tour preview fullscreen')}
    <div class="step" style="margin-top:12px">
      <div class="snum">13</div>
      <div class="sbody">
        <p class="stitle">Export as a single HTML file and share</p>
        <p class="sdesc">On the project dashboard, click <strong>Export Project</strong>. Choose <strong>Single HTML File</strong> &mdash; everything packed into one self-contained file. Click <strong>Export</strong> and the file downloads to your computer.</p>
        <div class="stip"><strong>Sharing:</strong> Attach the HTML file to an email, or copy to a USB drive. Recipients just double-click it &mdash; the tour opens in their browser with no internet or app required.</div>
      </div>
    </div>
    ${scWide(S + '10-export-page.png', 'Export &amp; Share page &mdash; download as HTML file, ZIP bundle, or backup', 'Export page')}
    <hr class="sdivider"/>
    <p class="eyebrow" style="margin-bottom:8px">Complete Workflow at a Glance</p>
    <div class="flow">
      <div class="fi"><div class="fc">1</div><div class="fl">Install App</div></div>
      <div class="fi"><div class="fc">2</div><div class="fl">Capture Photos</div></div>
      <div class="fi"><div class="fc">3</div><div class="fl">Transfer to PC</div></div>
      <div class="fi"><div class="fc">4</div><div class="fl">Create Project</div></div>
      <div class="fi"><div class="fc">5</div><div class="fl">Add Hotspots</div></div>
      <div class="fi"><div class="fc">6</div><div class="fl">Export HTML</div></div>
    </div>
    <div class="callout">
      <div class="callout-icon">&#128190;</div>
      <div class="callout-txt"><strong>Backup your project:</strong> On the Export page, also download the <strong>PanoStitch Backup (.panostitch)</strong> file. Re-import this on any computer to continue editing later.</div>
    </div>
  </div>
  ${ft(6)}
</div>`)

parts.push(`
</div>
<button class="print-btn no-print" onclick="window.print()">&#8659; Save as PDF</button>
</body>
</html>`)

const html = parts.join('\n')
const outLocal = path.join(__dirname, 'PanoStitch-Tutorial.html')
const outPublic = path.join(__dirname, '..', 'public', 'tutorial.html')
fs.writeFileSync(outLocal, html, 'utf8')
fs.writeFileSync(outPublic, html, 'utf8')
const kb = Math.round(fs.statSync(outLocal).size / 1024)
console.log(`Done! PanoStitch-Tutorial.html + public/tutorial.html (${kb} KB)`)
