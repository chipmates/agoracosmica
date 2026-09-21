/* THE PLAYER. Two stops and the leg between them, as stills and one clip.
   No build step, no framework, one file.

   The rules it is built to: the picture is there before anything is read; the
   visitor pays for a leg only when he walks it; two video elements at most,
   torn down by hand (the documented cure for the memory failure of many video
   elements); nothing plays backwards, because a rail that only runs forward
   never asks a phone to scrub. */
;(function () {
  const $ = (id) => document.getElementById(id)
  const still = $('still')
  const clip = $('clip')
  const t0 = performance.now()

  const state = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en',
    framing: innerWidth < innerHeight ? 'portrait' : 'landscape',
    stop: 0,
    lines: 720,
    media: null,
    stops: null,
    readout: {},
    warm: null,
  }
  const calm = matchMedia('(prefers-reduced-motion: reduce)')

  /** the lines to serve: the frame's own short side, capped by the line the
      browser admits to being on, and by the visitor asking for less data */
  function pickLines() {
    const ladder = state.media.framings[state.framing].sizes.map((s) => s.lines).sort((a, b) => a - b)
    const c = navigator.connection || {}
    if (c.saveData) return ladder[0]
    const kind = c.effectiveType || '4g'
    if (kind === 'slow-2g' || kind === '2g' || kind === '3g') return ladder[0]
    const short = Math.min(innerWidth, innerHeight) * (devicePixelRatio || 1)
    let want = ladder[0]
    for (const l of ladder) if (short >= l * 0.62) want = l
    return want
  }

  const sized = (list) => list.find((s) => s.lines === state.lines) || list[list.length - 1]
  const framing = () => state.media.framings[state.framing]

  function bytesSoFar() {
    let n = 0
    for (const r of performance.getEntriesByType('resource')) n += r.transferSize || r.encodedBodySize || 0
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav) n += nav.transferSize || nav.encodedBodySize || 0
    return n
  }
  const kB = (n) => Math.round(n / 1024) + ' kB'
  function say(key, value) {
    state.readout[key] = value
    const rows = $('rows')
    rows.textContent = ''
    for (const k of Object.keys(state.readout)) {
      const tr = document.createElement('tr')
      const a = document.createElement('td')
      a.textContent = k
      const b = document.createElement('td')
      b.textContent = String(state.readout[k])
      tr.append(a, b)
      rows.append(tr)
    }
  }

  function paint() {
    const stop = state.stops[state.stop]
    $('line').textContent = stop.line[state.lang]
    document.documentElement.lang = state.lang
    $('lang').textContent = state.lang === 'de' ? 'EN' : 'DE'
    const onward = $('onward')
    const back = $('back')
    if (state.stop === 0) {
      onward.hidden = false
      onward.textContent = state.stops[1].title[state.lang]
      back.hidden = true
    } else {
      onward.hidden = true
      back.hidden = false
      back.textContent = state.stops[0].title[state.lang]
    }
  }

  /** the next stop's picture and the leg, fetched while the visitor reads */
  function warm() {
    if (state.warm || state.stop !== 0) return
    const shot = sized(framing().stills.stop2)
    const img = new Image()
    img.decoding = 'async'
    img.src = shot.webp
    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    let video = null
    if (!calm.matches) {
      video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.src = sized(framing().sizes).file
      video.load()
    }
    state.warm = { img, ready, video }
  }

  /** the stop's own picture, shown the moment it can be shown */
  async function showStill(which, held) {
    const shot = sized(framing().stills[which])
    if (held && held.src === shot.webp) {
      still.src = held.src
    } else {
      still.src = shot.webp
    }
    if (still.decode) await still.decode().catch(() => {})
  }

  async function walk() {
    if (calm.matches) {
      /* no clip at all, and the readout says so: a cut is the whole walk */
      await showStill('stop2', state.warm && state.warm.img)
      state.stop = 1
      paint()
      say('leg', 'cut, reduced motion')
      return
    }
    warm()
    const video = state.warm.video
    clip.src = video.src
    clip.hidden = false
    const began = performance.now()
    const before = bytesSoFar()
    try {
      await clip.play()
    } catch {
      /* a refused play is a cut, which is what a rail that never scrubs can do */
      await showStill('stop2', state.warm.img)
      state.stop = 1
      paint()
      say('leg', 'play refused, cut')
      return
    }
    await new Promise((r) => clip.addEventListener('ended', r, { once: true }))
    /* THE CUT AT THE STOP IS INVISIBLE because the still IS the clip's last
       frame: the picture under the video is swapped and decoded first, and the
       video is only taken away on the frame after. */
    await state.warm.ready
    still.src = state.warm.img.src
    if (still.decode) await still.decode().catch(() => {})
    requestAnimationFrame(() => {
      clip.hidden = true
      clip.pause()
      clip.removeAttribute('src')
      clip.load()
    })
    state.stop = 1
    paint()
    const q = clip.getVideoPlaybackQuality ? clip.getVideoPlaybackQuality() : null
    const entry = performance.getEntriesByType('resource').find((r) => r.name.indexOf(video.src.split('/').pop()) >= 0)
    say('leg seconds', ((performance.now() - began) / 1000).toFixed(2))
    say('leg bytes', kB(entry ? entry.transferSize || entry.encodedBodySize : bytesSoFar() - before))
    say('dropped frames', q ? q.droppedVideoFrames + ' of ' + q.totalVideoFrames : 'not reported')
  }

  async function start() {
    const [media, lines] = await Promise.all([
      fetch('media.json').then((r) => r.json()),
      fetch('lines.json').then((r) => r.json()),
    ])
    state.media = media
    state.stops = lines.stops
    state.lines = pickLines()
    paint()
    const before = bytesSoFar()
    await showStill('stop1')
    say('first picture', ((performance.now() - t0) / 1000).toFixed(2) + ' s')
    say('bytes to it', kB(bytesSoFar()))
    say('served', state.framing + ' ' + state.lines + ' lines')
    say('line', (navigator.connection && navigator.connection.effectiveType) || 'not reported')
    void before
    /* the next leg and the next picture are fetched while the line is read */
    setTimeout(warm, 400)
  }

  $('onward').addEventListener('click', () => {
    $('onward').disabled = true
    walk().finally(() => {
      $('onward').disabled = false
    })
  })
  /* BACK PLAYS NOTHING. The leg exists in one direction only, so the way back
     is a cut, and the readout says that in as many words. */
  $('back').addEventListener('click', async () => {
    await showStill('stop1')
    state.stop = 0
    paint()
    say('back', 'cut, the leg runs one way')
  })
  $('lang').addEventListener('click', () => {
    state.lang = state.lang === 'de' ? 'en' : 'de'
    paint()
  })
  $('toggle').addEventListener('click', () => {
    $('readout').hidden = !$('readout').hidden
  })
  /* a turned phone is a different render, so the picture is picked again */
  addEventListener('orientationchange', () => {
    state.framing = innerWidth < innerHeight ? 'landscape' : 'portrait'
    state.lines = pickLines()
    state.warm = null
    showStill(state.stop === 0 ? 'stop1' : 'stop2')
  })
  start()
})()
