import JSZip from 'jszip'
import { db } from '@/lib/db/schema'
import type { Scene, Hotspot } from '@/lib/db/schema'

interface TourConfig {
  projectName: string
  scenes: TourScene[]
}

interface TourScene {
  id: string
  name: string
  haov: number
  vaov: number
  initialYaw: number
  initialPitch: number
  initialHfov: number
  panoramaFile: string
  thumbnailFile: string
  hotspots: TourHotspot[]
}

interface TourHotspot {
  id: string
  type: 'scene-link' | 'info'
  yaw: number
  pitch: number
  targetSceneId?: string
  targetYaw?: number
  targetPitch?: number
  targetHfov?: number
  title?: string
  description?: string
}

const INLINE_SIZE_LIMIT = 25 * 1024 * 1024 // 25 MB

export async function exportTourHTML(
  projectId: string,
  onProgress?: (pct: number) => void,
): Promise<{ zipBlob: Blob; totalBytes: number; canInline: boolean }> {
  onProgress?.(0)

  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Project not found')

  const scenes = await db.scenes.where('projectId').equals(projectId).toArray()
  const sceneIds = scenes.map((s) => s.id)
  const hotspots = sceneIds.length
    ? await db.hotspots.where('sceneId').anyOf(sceneIds).toArray()
    : []

  onProgress?.(5)

  // Load pannellum assets and logo from public URL
  const [pannellumJs, pannellumCss, logoDataUrl] = await Promise.all([
    fetch('/pannellum.js').then((r) => r.text()),
    fetch('/pannellum.css').then((r) => r.text()).catch(() => ''),
    fetch('/assets/cutm-logo-bg.png').then(async (r) => {
      const blob = await r.blob()
      return new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }).catch(() => ''),
  ])

  onProgress?.(10)

  const zip = new JSZip()
  const scenesFolder = zip.folder('scenes')!

  let totalBytes = 0
  const tourScenes: TourScene[] = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const sceneHotspots = hotspots.filter((h) => h.sceneId === scene.id)

    // Panorama
    const panoRecord = await db.blobs.get(scene.panoramaBlobId)
    const thumbRecord = await db.blobs.get(scene.thumbnailBlobId)

    if (panoRecord) {
      const panoExt = panoRecord.type === 'image/jpeg' ? 'jpg' : 'png'
      const panoFilename = `${scene.id}.${panoExt}`
      const thumbExt = thumbRecord?.type === 'image/jpeg' ? 'jpg' : 'png'
      const thumbFilename = `${scene.id}-thumb.${thumbExt}`

      const panoAB = await panoRecord.data.arrayBuffer()
      scenesFolder.file(panoFilename, panoAB)
      totalBytes += panoRecord.size

      if (thumbRecord) {
        const thumbAB = await thumbRecord.data.arrayBuffer()
        scenesFolder.file(thumbFilename, thumbAB)
        totalBytes += thumbRecord.size
      }

      tourScenes.push({
        id: scene.id,
        name: scene.name,
        haov: scene.haov,
        vaov: scene.vaov,
        initialYaw: scene.initialYaw,
        initialPitch: scene.initialPitch,
        initialHfov: scene.initialHfov,
        panoramaFile: `scenes/${panoFilename}`,
        thumbnailFile: thumbRecord ? `scenes/${thumbFilename}` : `scenes/${panoFilename}`,
        hotspots: sceneHotspots.map((h) => ({
          id: h.id,
          type: h.type,
          yaw: h.yaw,
          pitch: h.pitch,
          targetSceneId: h.targetSceneId,
          targetYaw: h.targetYaw,
          targetPitch: h.targetPitch,
          targetHfov: h.targetHfov,
          title: h.title,
          description: h.description,
        })),
      })
    }

    onProgress?.(10 + Math.round((i / scenes.length) * 75))
  }

  onProgress?.(85)

  const config: TourConfig = { projectName: project.name, scenes: tourScenes }
  const indexHtml = buildIndexHtml(config, undefined, undefined, logoDataUrl)

  zip.file('index.html', indexHtml)
  zip.file('pannellum.js', pannellumJs)
  if (pannellumCss) zip.file('pannellum.css', pannellumCss)

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  })

  onProgress?.(100)
  return { zipBlob, totalBytes, canInline: totalBytes < INLINE_SIZE_LIMIT }
}

export async function exportTourHTMLInline(
  projectId: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(0)
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Project not found')

  const scenes = await db.scenes.where('projectId').equals(projectId).toArray()
  const sceneIds = scenes.map((s) => s.id)
  const hotspots = sceneIds.length
    ? await db.hotspots.where('sceneId').anyOf(sceneIds).toArray()
    : []

  const [pannellumJs, pannellumCss, logoDataUrl] = await Promise.all([
    fetch('/pannellum.js').then((r) => r.text()),
    fetch('/pannellum.css').then((r) => r.text()).catch(() => ''),
    fetch('/assets/cutm-logo-bg.png').then(async (r) => {
      const blob = await r.blob()
      return new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }).catch(() => ''),
  ])

  onProgress?.(10)

  const tourScenes: TourScene[] = []
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const sceneHotspots = hotspots.filter((h) => h.sceneId === scene.id)
    const panoRecord = await db.blobs.get(scene.panoramaBlobId)
    const thumbRecord = await db.blobs.get(scene.thumbnailBlobId)

    let panoDataUrl = ''
    let thumbDataUrl = ''
    if (panoRecord) {
      panoDataUrl = await blobToDataUrl(panoRecord.data)
    }
    if (thumbRecord) {
      thumbDataUrl = await blobToDataUrl(thumbRecord.data)
    }

    tourScenes.push({
      id: scene.id,
      name: scene.name,
      haov: scene.haov,
      vaov: scene.vaov,
      initialYaw: scene.initialYaw,
      initialPitch: scene.initialPitch,
      initialHfov: scene.initialHfov,
      panoramaFile: panoDataUrl,
      thumbnailFile: thumbDataUrl || panoDataUrl,
      hotspots: sceneHotspots.map((h) => ({
        id: h.id,
        type: h.type,
        yaw: h.yaw,
        pitch: h.pitch,
        targetSceneId: h.targetSceneId,
        targetYaw: h.targetYaw,
        targetPitch: h.targetPitch,
        targetHfov: h.targetHfov,
        title: h.title,
        description: h.description,
      })),
    })

    onProgress?.(10 + Math.round((i / scenes.length) * 80))
  }

  onProgress?.(90)
  const config: TourConfig = { projectName: project.name, scenes: tourScenes }
  const html = buildIndexHtml(config, pannellumJs, pannellumCss, logoDataUrl)
  onProgress?.(100)
  return new Blob([html], { type: 'text/html' })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function buildIndexHtml(config: TourConfig, inlinePannellumJs?: string, inlinePannellumCss?: string, logoDataUrl?: string): string {
  const configJson = JSON.stringify(config)
  const isInline = !!inlinePannellumJs

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(config.projectName)}</title>
${isInline
    ? `<style>${inlinePannellumCss ?? ''}</style>`
    : `<link rel="stylesheet" href="pannellum.css">`
}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #f5f0e6; --ink-dim: #c8bfaa; --ink-faint: #7a7264;
    --bg: #0d0c0a; --surface: #1a1814; --line: #2d2a24;
    --accent: #d97757; --success: #5c9e6b;
  }
  html, body { height: 100%; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; overflow: hidden; }
  #viewer { position: fixed; inset: 0; }
  #overlay { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
  #overlay.hidden .fade-el { opacity: 0 !important; }
  .fade-el { transition: opacity 0.3s; }
  #top-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 72px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.65), transparent);
    display: flex; align-items: flex-start; padding: 14px 16px; gap: 12px;
    pointer-events: auto;
  }
  #title-block { flex: 1; min-width: 0; }
  #project-name { font-size: 18px; font-style: italic; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #scene-name { font-family: monospace; font-size: 11px; color: var(--ink-faint); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #top-controls { display: flex; gap: 6px; }
  .ctrl-btn {
    width: 32px; height: 32px; border-radius: 3px; border: 1px solid rgba(245,240,230,0.2);
    background: rgba(0,0,0,0.4); color: rgba(245,240,230,0.8); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s;
  }
  .ctrl-btn:hover { background: rgba(0,0,0,0.6); color: #f5f0e6; }
  .ctrl-btn svg { width: 16px; height: 16px; }
  #bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 120px; background: linear-gradient(to top, rgba(0,0,0,0.65), transparent); display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; padding: 0 16px 12px; pointer-events: auto; }
  #scene-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
  #scene-strip::-webkit-scrollbar { height: 3px; }
  #scene-strip::-webkit-scrollbar-thumb { background: rgba(245,240,230,0.2); border-radius: 2px; }
  .thumb-btn { flex-shrink: 0; cursor: pointer; border: none; background: none; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .thumb-img { width: 96px; height: 60px; border-radius: 3px; border: 2px solid rgba(245,240,230,0.2); object-fit: cover; transition: border-color 0.2s; background: var(--surface); }
  .thumb-btn.current .thumb-img { border-color: var(--accent); }
  .thumb-label { font-family: monospace; font-size: 9px; letter-spacing: 0.05em; color: rgba(245,240,230,0.5); max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .thumb-btn.current .thumb-label { color: var(--accent); }
  #nav-row { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
  #scene-counter { font-family: monospace; font-size: 11px; color: rgba(245,240,230,0.7); min-width: 80px; text-align: center; }
  #info-panel {
    position: fixed; top: 0; right: 0; bottom: 0; width: 320px;
    background: rgba(13,12,10,0.96); backdrop-filter: blur(12px);
    border-left: 1px solid rgba(45,42,36,0.5);
    display: flex; flex-direction: column; z-index: 20;
    transform: translateX(100%); transition: transform 0.3s;
  }
  #info-panel.open { transform: translateX(0); }
  #info-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(45,42,36,0.4); }
  #info-title { font-size: 22px; font-style: italic; font-weight: 600; color: var(--ink); line-height: 1.3; }
  #info-desc { font-size: 14px; color: var(--ink-dim); line-height: 1.6; white-space: pre-line; }
  #info-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .close-btn { width: 28px; height: 28px; border-radius: 3px; border: 1px solid var(--line); background: none; color: var(--ink-faint); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .close-btn:hover { color: var(--ink); }
  #footer { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 9px; color: rgba(245,240,230,0.22); letter-spacing: 0.1em; text-transform: uppercase; z-index: 5; pointer-events: none; background: rgba(0,0,0,0.18); padding: 4px 10px 4px 6px; border-radius: 20px; backdrop-filter: blur(4px); }
  #footer img { width: 14px; height: 14px; object-fit: contain; opacity: 0.35; }
  .pano-hs-scene, .pano-hs-info { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; animation: pulse 2s ease-in-out infinite; }
  .pano-hs-scene { border: 2px solid #d97757; color: #d97757; background: rgba(13,12,10,0.7); }
  .pano-hs-scene svg { width: 16px; height: 16px; }
  .pano-hs-info { width: 30px; height: 30px; border: 2px solid #f5f0e6; color: #f5f0e6; background: rgba(13,12,10,0.7); font-style: italic; font-family: Georgia,serif; font-size: 14px; }
  .pano-hs-scene:hover, .pano-hs-info:hover { transform: scale(1.15); }
  .pano-hs-label { position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%); background: rgba(22,20,15,0.9); color: #f5f0e6; font-size: 10px; font-family: monospace; padding: 3px 8px; border-radius: 2px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s; }
  .pano-hs-scene:hover .pano-hs-label, .pano-hs-info:hover .pano-hs-label { opacity: 1; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.4); } 50% { box-shadow: 0 0 0 8px rgba(217,119,87,0); } }
</style>
</head>
<body>
<div id="viewer"></div>

<div id="overlay" class="fade-el">
  <div id="top-bar" class="fade-el">
    <div id="title-block">
      <div id="project-name">${escapeHtml(config.projectName)}</div>
      <div id="scene-name"></div>
    </div>
    <div id="top-controls">
      <button class="ctrl-btn" id="btn-autorotate" title="Toggle auto-rotate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>
      <button class="ctrl-btn" id="btn-fullscreen" title="Fullscreen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="fs-icon-expand"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="fs-icon-shrink" style="display:none"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
      </button>
    </div>
  </div>

  <div id="bottom" class="fade-el">
    <div id="scene-strip"></div>
    <div id="nav-row">
      <button class="ctrl-btn" id="btn-prev" title="Previous scene" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span id="scene-counter">scene 01 / 01</span>
      <button class="ctrl-btn" id="btn-next" title="Next scene">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>
</div>

<div id="info-panel">
  <div id="info-header">
    <span style="font-family:monospace;font-size:10px;letter-spacing:0.1em;color:var(--ink-faint);text-transform:uppercase;">info</span>
    <button class="close-btn" id="info-close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div id="info-body">
    <div id="info-title"></div>
    <div id="info-desc"></div>
  </div>
</div>

<div id="footer">${logoDataUrl ? `<img src="${logoDataUrl}" alt="" aria-hidden="true" />` : ''}Created with PanoStitch · CUTM</div>

${isInline ? `<script>${inlinePannellumJs}</script>` : `<script src="pannellum.js"></script>`}
<script>
(function() {
  var config = ${configJson};
  var scenes = config.scenes;
  var currentIdx = 0;
  var viewer = null;
  var overlayTimer = null;
  var autoRotating = false;
  var infoOpen = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function showOverlay() {
    var el = document.getElementById('overlay');
    el.classList.remove('hidden');
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function() { el.classList.add('hidden'); }, 3000);
  }

  function buildHotspotConfig(hotspots) {
    return hotspots.map(function(h) {
      return {
        id: h.id,
        pitch: h.pitch,
        yaw: h.yaw,
        type: h.type === 'info' ? 'info' : 'custom',
        text: h.title || '',
        cssClass: h.type === 'scene-link' ? 'pano-hotspot-scene' : 'pano-hotspot-info',
        createTooltipFunc: function(container) {
          if (h.type === 'scene-link') {
            container.innerHTML = '<div class="pano-hs-scene"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>';
          } else {
            container.innerHTML = '<div class="pano-hs-info"><em>i</em></div>';
          }
          if (h.title) {
            var tip = document.createElement('span');
            tip.className = 'pano-hs-label';
            tip.textContent = h.title;
            container.appendChild(tip);
          }
          container.addEventListener('click', function() { handleHotspotClick(h); });
        }
      };
    });
  }

  function handleHotspotClick(h) {
    if (h.type === 'info') {
      document.getElementById('info-title').textContent = h.title || '';
      document.getElementById('info-desc').textContent = h.description || '';
      document.getElementById('info-panel').classList.add('open');
      infoOpen = true;
      return;
    }
    if (h.type === 'scene-link' && h.targetSceneId) {
      var idx = scenes.findIndex(function(s) { return s.id === h.targetSceneId; });
      if (idx >= 0) loadScene(idx, h.targetYaw, h.targetPitch, h.targetHfov);
    }
  }

  function loadScene(idx, yaw, pitch, hfov) {
    if (idx === currentIdx && viewer) return;
    currentIdx = idx;
    var scene = scenes[idx];
    if (viewer) { try { viewer.destroy(); } catch(e) {} viewer = null; }
    viewer = pannellum.viewer('viewer', {
      type: 'equirectangular',
      panorama: scene.panoramaFile,
      haov: scene.haov,
      vaov: scene.vaov,
      yaw: yaw !== undefined ? yaw : scene.initialYaw,
      pitch: pitch !== undefined ? pitch : scene.initialPitch,
      hfov: hfov !== undefined ? hfov : scene.initialHfov,
      autoLoad: true,
      showControls: false,
      mouseZoom: true,
      autoRotate: autoRotating ? 1 : 0,
      hotSpots: buildHotspotConfig(scene.hotspots),
    });
    document.getElementById('scene-name').textContent = scene.name;
    document.getElementById('scene-counter').textContent = 'scene ' + pad(idx+1) + ' / ' + pad(scenes.length);
    document.getElementById('btn-prev').disabled = idx === 0;
    document.getElementById('btn-next').disabled = idx === scenes.length - 1;
    var thumbs = document.querySelectorAll('.thumb-btn');
    thumbs.forEach(function(t, i) { t.classList.toggle('current', i === idx); });
  }

  // Build scene strip
  var strip = document.getElementById('scene-strip');
  scenes.forEach(function(scene, i) {
    var btn = document.createElement('button');
    btn.className = 'thumb-btn' + (i === 0 ? ' current' : '');
    btn.title = scene.name;
    btn.innerHTML = '<img class="thumb-img" src="' + scene.thumbnailFile + '" alt="' + escapeAttr(scene.name) + '"><span class="thumb-label">' + escapeHtml(scene.name) + '</span>';
    btn.addEventListener('click', function() { loadScene(i); showOverlay(); });
    strip.appendChild(btn);
  });

  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s) { return String(s).replace(/"/g,'&quot;'); }

  // Controls
  document.getElementById('btn-prev').addEventListener('click', function() {
    if (currentIdx > 0) { loadScene(currentIdx - 1); showOverlay(); }
  });
  document.getElementById('btn-next').addEventListener('click', function() {
    if (currentIdx < scenes.length - 1) { loadScene(currentIdx + 1); showOverlay(); }
  });
  document.getElementById('btn-autorotate').addEventListener('click', function() {
    autoRotating = !autoRotating;
    this.style.borderColor = autoRotating ? 'rgba(217,119,87,0.6)' : '';
    this.style.color = autoRotating ? '#d97757' : '';
    if (viewer) viewer.setAutoRotate(autoRotating ? 1 : 0);
  });
  document.getElementById('btn-fullscreen').addEventListener('click', function() {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); }
    else { document.exitFullscreen(); }
  });
  document.addEventListener('fullscreenchange', function() {
    var fs = !!document.fullscreenElement;
    document.getElementById('fs-icon-expand').style.display = fs ? 'none' : '';
    document.getElementById('fs-icon-shrink').style.display = fs ? '' : 'none';
  });
  document.getElementById('info-close').addEventListener('click', function() {
    document.getElementById('info-panel').classList.remove('open');
    infoOpen = false;
  });

  // Keyboard
  document.addEventListener('keydown', function(e) {
    showOverlay();
    if (e.key === 'ArrowLeft' && currentIdx > 0) loadScene(currentIdx - 1);
    if (e.key === 'ArrowRight' && currentIdx < scenes.length - 1) loadScene(currentIdx + 1);
    if (e.key === 'f') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
    if (e.key === 'Escape' && infoOpen) {
      document.getElementById('info-panel').classList.remove('open');
      infoOpen = false;
    }
  });

  // Overlay on mouse move
  document.addEventListener('mousemove', showOverlay);
  document.addEventListener('click', showOverlay);

  // Init
  if (scenes.length > 0) loadScene(0);
  showOverlay();
})();
</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function tourZipFilename(projectName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safe = projectName.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)
  return `${safe}-tour-${date}.zip`
}

export function tourHtmlFilename(projectName: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safe = projectName.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)
  return `${safe}-tour-${date}.html`
}
