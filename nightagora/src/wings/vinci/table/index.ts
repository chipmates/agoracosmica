import { BoxGeometry, DoubleSide, Group, Mesh, MeshStandardNodeMaterial, type Texture, type Camera, type Scene } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { frontFacing, texture, uv, vec2 } from 'three/tsl'
import type { Stack } from '../../../stack'
import type { ManifestIndex } from '../../../manifest'
import { buildFurniture, bendLeaf, leafGeometry, linenSupportGeometry, LEAF, PAGE_Y } from './geometry'
import { createPageStream } from './stream'
import { createPanel } from './panel'
import { buildFolioShelf } from './folio-shelf'
import { createMirrorDetail } from './mirror-detail'
import type { PageRecord } from './content'

export { LEAF } from './geometry'
export type { PageRecord } from './content'

/** The reader finds the table it reads by the table's own object, the way
 * the registry finds every exhibit: a read over the scene. */
const tables = new WeakMap<object, ReadingTable>()
export function readingTableOf(object: object): ReadingTable | undefined {
  return tables.get(object)
}

/** A room imports this module unchanged. It owns placement and light; the
 * module owns its independent sheets, manifested pixels and reading controls. */
/** how far the reading copy's mount is raked back from the table, in radians */
const MOUNT_RAKE = 0.384

export function buildTable(stack: Stack, pages: PageRecord[], manifest: ManifestIndex) {
  if (pages.length !== 438) throw new Error('The table requires the complete 438-record edition')
  const furniture = buildFurniture(stack)
  const object = furniture.object
  const stream = createPageStream(manifest)
  let index = 340, serial = 0, alive = true, isClosed = false, mirrored = false, flipped = false
  let turning = false, preparing = false, turnProgress = 0, started = 0, held = false, direction = 1
  let targetIndex = index, lastTurnMs = 0
  let rightTexture: Texture | null = null, leftTexture: Texture | null = null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const front = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, envMapIntensity: 0.12, side: DoubleSide })
  const facing = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, envMapIntensity: 0.12, side: DoubleSide })
  const reflected = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, envMapIntensity: 0.12, side: DoubleSide })
  const turningMaterial = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, envMapIntensity: 0.12, side: DoubleSide })
  /* THE PAGE SITS INSIDE THE LAMP'S FALLOFF LIKE EVERYTHING ELSE ON THE
     TABLE. A spread lit dead flat across 34 cm is a scan, not a page under a
     reading lamp: the near leaf keeps the plate's own tone and the far one
     loses about a quarter of it, which is what the eye reads as one light in
     a dark room. The plate's colour is untouched; only the light on it. */
  const pagePool = furniture.pool.mul(0.55).add(0.45)
  // Keep the program graph stable when the admitted page texture changes.
  const frontSample = texture()
  const facingSample = texture(undefined, vec2(uv().x.oneMinus(), uv().y))
  const reflectedSample = texture(undefined, vec2(uv().x.oneMinus(), uv().y))
  front.colorNode = frontSample.mul(pagePool)
  facing.colorNode = facingSample.mul(pagePool)
  reflected.colorNode = reflectedSample.mul(pagePool)
  const turnFront = texture()
  const turnBack = texture(undefined, vec2(uv().x.oneMinus(), uv().y))
  turningMaterial.colorNode = frontFacing.select(turnFront, turnBack).mul(pagePool)
  const right = new Mesh(leafGeometry(), front)
  right.name = 'open-facsimile-plate'
  /* The resting sheet receives; it does not cast. It lies on its own text
     block under a raking key, so its shadow falls where nothing can see it,
     and two cascades of it are four draws of the table's forty. */
  right.receiveShadow = true
  const left = new Mesh(leafGeometry(), facing)
  bendLeaf(left.geometry, 0, -1)
  left.name = 'facing-edition-page-thumbnail'
  left.receiveShadow = true
  const moving = new Mesh(leafGeometry(), turningMaterial)
  moving.name = 'turning-facsimile-sheet'
  moving.castShadow = moving.receiveShadow = true
  moving.visible = false
  object.add(right, left, moving)
  const reflection = new Group()
  reflection.name = 'labelled-mirrored-reading-copy'
  reflection.position.x = 0.19
  reflection.userData['manifestId'] = 'vinci/table-module'
  reflection.userData['assetClass'] = 'GENERATED'
  /* THE COPY IS ON A STAND, NOT LOOSE ON THE TABLE. Flat beside the book it
     read as a third leaf blown there; on a raked mount with a plinth and a
     lip it is an object a hand placed in the room, which is what "beside it"
     has to say at a glance. The rake is 22 degrees and not upright: the key
     stands behind this table, so a plate turned to face the visitor turns its
     face away from the only light in the room. */
  const easel = new Group()
  easel.name = 'reading-copy-mount'
  easel.rotation.x = MOUNT_RAKE
  easel.position.y = 0.0125
  const mirrorPage = new Mesh(leafGeometry(), reflected)
  bendLeaf(mirrorPage.geometry, 0, 1, 0)
  mirrorPage.name = 'horizontally-reversed-facsimile'
  easel.add(mirrorPage)
  const mountParts = [
    // the matted board the sheet lies on, a centimetre proud on every side
    linenSupportGeometry(0.187, 0.005, 0.259).translate(0.079, PAGE_Y - 0.0058, 0),
    // the lip that holds the sheet at the foot of the rake
    new BoxGeometry(0.187, 0.010, 0.009).translate(0.079, PAGE_Y - 0.0005, 0.1315),
  ]
  const mountGeometry = mergeGeometries(mountParts, false)!
  mountParts.forEach(part => part.dispose())
  const mount = new Mesh(mountGeometry, furniture.materials[3])
  mount.receiveShadow = true
  mount.userData['manifestId'] = 'vinci/table-furniture'
  mount.userData['assetClass'] = 'GENERATED'
  easel.add(mount)
  reflection.add(easel)
  /* THE PLINTH. The mount's raked foot needs something to stand on, and the
     block under it is what keeps the whole thing from reading as a sheet
     propped against nothing. */
  const plinthParts = [
    new BoxGeometry(0.196, 0.022, 0.150).translate(0.079, 0.0075, -0.036),
    new BoxGeometry(0.204, 0.007, 0.262).translate(0.079, -0.0005, 0),
  ]
  const plinthGeometry = mergeGeometries(plinthParts, false)!
  plinthParts.forEach(part => part.dispose())
  const plinth = new Mesh(plinthGeometry, furniture.materials[1])
  plinth.name = 'reading-copy-plinth'
  plinth.receiveShadow = true
  plinth.userData['manifestId'] = 'vinci/table-furniture'
  plinth.userData['assetClass'] = 'GENERATED'
  reflection.add(plinth)
  reflection.visible = false
  object.add(reflection)
  // An isolated reading plate for the narrow bench. It shares the admitted
  // texture, while the complete spread remains the page-turn presentation.
  const spreadParts = [...object.children]
  const savedVisibility = new Map(spreadParts.map(part => [part,part.visible]))
  const singleLeaf = new Group()
  singleLeaf.name = 'single-plate-reading-support'
  singleLeaf.userData['manifestId'] = 'vinci/table-module'
  singleLeaf.userData['assetClass'] = 'GENERATED'
  const readingPage = new Mesh(leafGeometry(), front)
  bendLeaf(readingPage.geometry, 0, 1, 0)
  readingPage.castShadow = readingPage.receiveShadow = true
  const readingSupport = new Mesh(linenSupportGeometry(0.174, 0.006, 0.244), furniture.materials[3])
  /* THE COCKLE IS 1.6 MM DEEP AT THE FORE EDGE, so a support one millimetre
     under the sheet's rest plane comes through it wherever the paper dips.
     Three millimetres of clearance holds every trough. */
  readingSupport.position.y = PAGE_Y - 0.0063
  readingSupport.receiveShadow = true
  readingSupport.userData['manifestId'] = 'vinci/table-module'
  readingSupport.userData['assetClass'] = 'GENERATED'
  singleLeaf.add(readingSupport,readingPage)
  singleLeaf.position.y = -0.023
  singleLeaf.visible = false
  object.add(singleLeaf)
  let paperOnlyMode = false
  function paperOnly(on: boolean) {
    if (on && !paperOnlyMode) for (const part of spreadParts) savedVisibility.set(part,part.visible)
    if (on) for (const part of spreadParts) part.visible = part === furniture.ground
    if (!on && paperOnlyMode) {
      for (const part of spreadParts) part.visible = savedVisibility.get(part) ?? true
      close(isClosed)
    }
    paperOnlyMode = on
    singleLeaf.visible = on && Boolean(rightTexture)
  }
  let ready: Promise<void> = Promise.resolve()
  let warming: Promise<void> | null = null, prewarmed = false, prewarmError: string | null = null
  let cancelPrewarm: (() => void) | null = null, prewarmDraws = 0
  let prewarmPass: { samples: number; colorType: number; textures: number } | null = null
  const panel = createPanel(pages, folio => { void open(folio) })
  const folioShelf = buildFolioShelf(pages, manifest, {wood: furniture.materials[0]!, fitting: furniture.materials[7]!, light: furniture.rackLight})
  object.add(folioShelf.object)
  const mirrorDetail = createMirrorDetail()

  interface TurningSpread {
    ticket: number
    destination: number
    right: Texture
    left: Texture
    full: Texture | null
    sourceHeight: number
    destinationHeight: number
    sourceThickness: number
    destinationThickness: number
    imageFailed: boolean
  }
  let spread: TurningSpread | null = null

  function heights(): {left: number; right: number} {
    // The optional shape keeps this module usable with the initial carrier
    // while the room adopts the carrier's measured stack-height interface.
    const carrier = furniture as typeof furniture & { pageHeights?: () => {left:number;right:number} }
    return carrier.pageHeights?.() ?? {left:PAGE_Y, right:PAGE_Y}
  }
  function restHeights() {
    const h = heights()
    const thickness = furniture.thicknesses()
    bendLeaf(right.geometry,0,1,thickness.right)
    bendLeaf(left.geometry,0,-1,thickness.left)
    right.position.y = h.right - PAGE_Y
    left.position.y = h.left - PAGE_Y
  }
  function stamp(mesh: Mesh, tex: Texture) {
    mesh.userData['manifestId'] = tex.userData['manifestId']
    mesh.userData['assetClass'] = 'PD-ART'
    mesh.userData['page'] = tex.userData['page']
  }
  function claim(tex: Texture | null) {
    if (tex) {
      panel.element.dataset['naClaim'] = 'documented'
      panel.element.dataset['naAnchor'] = String(tex.userData['manifestId'])
      panel.element.dataset['naAnchorClass'] = 'PD-ART'
    } else {
      delete panel.element.dataset['naClaim']
      delete panel.element.dataset['naAnchor']
      delete panel.element.dataset['naAnchorClass']
    }
  }
  function sized(tex: Texture, mesh: Mesh) {
    const img = tex.image as {width:number;height:number}
    const aspect = img.width / img.height
    // Contain the COMPLETE plate. The wider title page reduces its height;
    // the usual portrait scan reduces its width. Neither is stretched.
    mesh.scale.x = Math.min(1, LEAF.height * aspect / LEAF.width)
    mesh.scale.z = Math.min(1, LEAF.width / (LEAF.height * aspect))
  }
  function attachRight(tex: Texture, withReflection = true) {
    rightTexture = tex
    frontSample.value = tex
    sized(tex, right)
    stamp(right, tex)
    sized(tex, readingPage)
    stamp(readingPage, tex)
    readingPage.position.x = -(0.003 + LEAF.width / 2) * readingPage.scale.x
    right.visible = !isClosed
    // A leaf read in the mirror hand keeps its reversal through a turn.
    if (flipped && !withReflection) reflectedSample.value = tex
    if (withReflection) {
      mirrorDetail.update(tex)
      reflectedSample.value = tex
      sized(tex, mirrorPage)
      stamp(mirrorPage, tex)
      reflection.visible = mirrored && !isClosed
      furniture.copyContact.value = reflection.visible ? 1 : 0
    }
  }
  function attachLeft(tex: Texture) {
    leftTexture = tex
    facingSample.value = tex
    sized(tex, left)
    stamp(left, tex)
    left.visible = !isClosed
  }
  function attachMoving(tex: Texture, reverse: Texture = tex) {
    // A physical leaf carries consecutive edition faces. Its reverse remains
    // the actual blank or printed source, with UVs readable on landing.
    turnFront.value = direction > 0 ? tex : reverse
    turnBack.value = direction > 0 ? reverse : tex
    sized(tex, moving)
    stamp(moving, tex)
  }
  function prewarmTurn(scene: Scene, camera: Camera): Promise<void> {
    if (warming) return warming
    if (!alive || reduced || turning || prewarmed || !rightTexture) return Promise.resolve()
    const ticket = serial
    prewarmError = null
    prewarmDraws = 0
    prewarmPass = null
    turnFront.value = rightTexture
    turnBack.value = rightTexture
    // The resting exposed face uses the same admitted image, white base and
    // roughness as the turn material. Warm that real sheet through the room's
    // actual post pass, including its nested render-context and shadow caches.
    // No auxiliary mesh, image allocation, or renderer target mutation occurs.
    const participants = [right, readingPage].map(mesh => ({ mesh,
      material: mesh.material, onAfterRender: mesh.onAfterRender }))
    const job = new Promise<void>(resolve => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (complete: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        for (const participant of participants) {
          participant.mesh.material = participant.material
          participant.mesh.onAfterRender = participant.onAfterRender
        }
        cancelPrewarm = null
        prewarmed = complete && alive && ticket === serial
        resolve()
      }
      cancelPrewarm = () => finish(false)
      timer = setTimeout(() => {
        if (alive) prewarmError = 'No two resting-sheet draws during turn preparation'
        finish(false)
      }, 10000)
      for (const participant of participants) {
        participant.mesh.material = turningMaterial
        participant.mesh.onAfterRender = function (...args) {
          participant.onAfterRender.apply(this, args)
          const [, renderedScene, renderedCamera, , material] = args
          if (settled || renderedScene !== scene || renderedCamera !== camera || material !== turningMaterial) return
          prewarmDraws++
          const target = stack.renderer.getRenderTarget()
          prewarmPass = target ? { samples: target.samples, colorType: target.texture.type,
            textures: target.textures.length } : null
          // Restore only after the whole current render has returned.
          if (prewarmDraws >= 2) queueMicrotask(() => finish(true))
        }
      }
    })
    warming = job.finally(() => { warming = null })
    ready = warming
    return warming
  }
  function pinVisibleThumbnails(at: number, destination = at) {
    // Both resting sheets, the moving source, and both incoming sheets must
    // survive late neighbour loads. These pins never retain a full 2K plate.
    stream.pinThumbnails([
      pages[at]!.file, pages[Math.max(0, at - 1)]!.file,
      pages[destination]!.file, pages[Math.max(0, destination - 1)]!.file,
    ])
  }
  function warmNeighbours(at: number) {
    for (const n of [at - 2, at + 1, at + 2]) {
      if (n < 0 || n >= pages.length) continue
      void stream.load(pages[n]!.file, false).catch(() => { /* errors remain in the stream's telemetry */ })
    }
  }
  function cancelTurn() {
    turning = preparing = held = false
    spread = null
    moving.visible = false
    moving.position.set(0, 0, 0)
  }
  async function show(n: number): Promise<void> {
    cancelPrewarm?.()
    const ticket = ++serial
    cancelTurn()
    index = Math.max(0, Math.min(pages.length - 1, n))
    const page = pages[index]!
    const previous = pages[Math.max(0, index - 1)]!
    // Remove old testimony before changing its label. Failed pixels leave
    // an explicit unavailable page, never the previous folio under new copy.
    rightTexture = leftTexture = null
    right.visible = left.visible = reflection.visible = singleLeaf.visible = false
    claim(null)
    mirrorDetail.update(null)
    panel.update(page)
    delete panel.element.dataset['loadError']
    panel.element.dataset['loading'] = 'true'
    furniture.progress(index, pages.length)
    restHeights()
    pinVisibleThumbnails(index)
    stream.retain([page.file])
    const attach = (tex: Texture) => {
      if (!alive || ticket !== serial) return
      attachRight(tex)
      claim(tex)
      delete panel.element.dataset['loading']
    }
    const jobs = [
      stream.load(previous.file, false).then(tex => {
        if (alive && ticket === serial) attachLeft(tex)
      }),
      stream.load(page.file, true, attach).then(attach),
    ]
    const result = await Promise.allSettled(jobs)
    if (!alive || ticket !== serial) return
    delete panel.element.dataset['loading']
    if (result.some(item => item.status === 'rejected')) panel.element.dataset['loadError'] = 'true'
    // The facing sheet is a thumbnail, so only the open page retains 2K.
    stream.retain([page.file])
    warmNeighbours(index)
  }
  function resolve(folio: string): number {
    const edition = /^edition:(\d+)$/.exec(folio)
    if (edition) return Math.max(0, Math.min(pages.length - 1, Number(edition[1])))
    const parsed = /^(?:([BD]):?)?\s*(\d+)(r|v)$/i.exec(folio)
    if (!parsed) return -1
    return pages.findIndex(p => p.page_kind === 'facsimile' && p.codex === (parsed[1]?.toUpperCase() ?? 'B') && p.folio === Number(parsed[2]) && p.side === (parsed[3]?.toLowerCase() === 'r' ? 'recto' : 'verso'))
  }
  function close(on: boolean) {
    if (on) cancelPrewarm?.()
    if (on) { mirrored = false; panel.showShelf(false) }
    if (on && turning) {
      serial++
      cancelTurn()
      // A partially exposed spread is replaced by the known current page
      // when the closed book is opened again.
      rightTexture = leftTexture = null
      pinVisibleThumbnails(index)
      stream.retain([pages[index]!.file])
    }
    isClosed = on
    furniture.closed.visible = on
    furniture.book.visible = !on
    left.visible = !on && Boolean(leftTexture)
    right.visible = !on && Boolean(rightTexture)
    moving.visible = !on && turning && !preparing
    reflection.visible = !on && mirrored && Boolean(rightTexture)
    furniture.copyContact.value = reflection.visible ? 1 : 0
    panel.element.hidden = on
  }
  async function open(folio: string): Promise<void> {
    const n = resolve(folio)
    if (n < 0) throw new Error(`No represented manuscript side: ${folio}`)
    turnProgress = 0
    mirror(false)
    panel.showShelf(false)
    close(false)
    ready = show(n)
    await ready
  }
  function poseTurn(progress: number) {
    if (!spread) return
    const thickness = spread.sourceThickness + (spread.destinationThickness - spread.sourceThickness) * progress
    bendLeaf(moving.geometry, progress, direction, thickness)
    // bendLeaf's ±3mm gutter root changes side; translate that root over
    // the turn so the final sheet meets its receiving rest sheet exactly.
    moving.position.x = -direction * 0.006 * moving.scale.x * progress
    moving.position.y = spread.sourceHeight + (spread.destinationHeight - spread.sourceHeight) * progress - PAGE_Y + 0.00012
  }
  async function prepareTurn(dir: number, inspection: number | null = null): Promise<void> {
    if (warming) {
      const ticket = serial
      await warming
      if (!alive || ticket !== serial) return
    }
    if (!alive || turning || !rightTexture) return
    const destination = Math.max(0, Math.min(pages.length - 1, index + 2 * Math.sign(dir)))
    if (destination === index) return
    if (reduced && inspection === null) { await show(destination); return }
    const ticket = ++serial
    direction = Math.sign(dir) || 1
    targetIndex = destination
    turning = preparing = true
    held = inspection !== null
    turnProgress = 0
    delete panel.element.dataset['loadError']
    const sourceTexture = direction > 0 ? rightTexture : leftTexture
    if (!sourceTexture) { cancelTurn(); return }
    const sourceHeight = direction > 0 ? heights().right : heights().left
    const sourceThickness = direction > 0 ? furniture.thicknesses().right : furniture.thicknesses().left
    const nextPage = pages[destination]!
    const nextLeft = pages[Math.max(0, destination - 1)]!
    pinVisibleThumbnails(index, destination)
    stream.retain([pages[index]!.file, nextPage.file])
    try {
      // The incoming image exists before the leaf reveals it. These are
      // normally warm thumbnails, never a hidden full-book preload.
      const [nextRightTexture, nextLeftTexture] = await Promise.all([
        stream.load(nextPage.file, false), stream.load(nextLeft.file, false),
      ])
      if (!alive || ticket !== serial) return
      furniture.progress(destination, pages.length)
      restHeights()
      const state: TurningSpread = {
        ticket, destination, right: nextRightTexture, left: nextLeftTexture, full: null,
        sourceHeight, destinationHeight: direction > 0 ? heights().left : heights().right,
        sourceThickness, destinationThickness: direction > 0 ? furniture.thicknesses().left : furniture.thicknesses().right,
        imageFailed: false,
      }
      spread = state
      attachMoving(sourceTexture, direction > 0 ? nextLeftTexture : nextRightTexture)
      if (direction > 0) attachRight(nextRightTexture, false)
      else attachLeft(nextLeftTexture)
      moving.visible = !isClosed
      preparing = false
      turnProgress = inspection ?? 0
      started = performance.now()
      poseTurn(turnProgress)
      // This upgrade cannot change the current label. It is attached to
      // the incoming sheet, then committed with its label at the landing.
      void stream.load(nextPage.file, true).then(tex => {
        if (!alive || ticket !== serial) return
        state.full = tex
        if (turning) {
          if (direction > 0) attachRight(tex, false)
          else turnFront.value = tex
        } else if (index === destination) {
          attachRight(tex)
          claim(tex)
          stream.retain([nextPage.file])
        }
      }).catch(error => {
        if (!alive || ticket !== serial || (error instanceof DOMException && error.name === 'AbortError')) return
        state.imageFailed = true
        panel.element.dataset['loadError'] = 'true'
      })
    } catch {
      if (!alive || ticket !== serial) return
      cancelTurn()
      pinVisibleThumbnails(index)
      stream.retain([pages[index]!.file])
      panel.element.dataset['loadError'] = 'true'
    }
  }
  function turn(dir: number) {
    if (isClosed) return
    ready = prepareTurn(dir)
  }
  function update(now = performance.now()) {
    const rackStands = !panel.shelf.hidden && !isClosed && !paperOnlyMode
    folioShelf.setVisible(rackStands)
    furniture.shelfContact.value = rackStands ? 1 : 0
    if (!turning || preparing || held || !spread) return
    turnProgress = Math.max(0, Math.min(1, (now - started) / 1000))
    poseTurn(turnProgress)
    if (turnProgress >= 1) {
      const landed = spread
      lastTurnMs = now - started
      index = landed.destination
      // The receiving sheets already occupy the endpoints. Transfer their
      // pixels and remove the moving sheet; no sheet resets across the book.
      attachRight(landed.full ?? landed.right)
      attachLeft(landed.left)
      panel.update(pages[index]!)
      claim(landed.full ?? landed.right)
      if (landed.imageFailed) panel.element.dataset['loadError'] = 'true'
      else delete panel.element.dataset['loadError']
      cancelTurn()
      pinVisibleThumbnails(index)
      stream.retain([pages[index]!.file])
      warmNeighbours(index)
    }
  }
  function mirror(on: boolean) {
    if (on) {
      panel.showShelf(false)
      close(false)
      if (!rightTexture) ready = show(index)
    }
    mirrored = on
    reflection.visible = on && !isClosed && Boolean(rightTexture)
    furniture.copyContact.value = reflection.visible ? 1 : 0
  }
  /** THE MIRROR HAND ON THE LEAF ITSELF: the open leaf samples its own plate
   * reversed, where it lies, with no second sheet and no second texture. */
  function flipLeaf(on: boolean) {
    flipped = on
    if (on && rightTexture) reflectedSample.value = rightTexture
    right.material = on ? reflected : front
    readingPage.material = on ? reflected : front
  }
  function holdTurn(progress = 0.5) {
    ready = prepareTurn(1, Math.max(0, Math.min(1, progress)))
  }
  close(false)
  ready = show(index)
  const api = {
    object, open, turn, panel, mirror, mirrorDetail, paperOnly, prewarmTurn, shelf: panel.shelf, close, update, holdTurn, flipLeaf,
    pages: pages as readonly PageRecord[],
    /** The edition record open now, and whether a leaf is on its way over. */
    at: () => index,
    turning: () => turning || preparing,
    resolve,
    ready: () => ready,
    pending: () => stream.pending() + folioShelf.pending() + furniture.library.pending() + Number(preparing) + Number(warming !== null),
    snapshot: (includeText = true) => ({
      folio: pages[index]?.folio, side: pages[index]?.side, codex: pages[index]?.codex,
      file: pages[index]?.file, editionIndex: index, total: pages.length,
      turn: { active: turning, preparing, progress: turnProgress, direction, targetEditionIndex: targetIndex, editionFacesPerLeaf: 2, durationMs: 1000, lastObservedMs: lastTurnMs, heldForInspection: held, warming: warming !== null, prewarmed, prewarmError, prewarmDraws, prewarmPass, prewarmMethod: 'resting-sheet-through-room-post' },
      carriers: furniture.carriers(),
      closed: isClosed, mirror: mirrored, presentation: paperOnlyMode ? 'single-plate' : 'spread', detailCanvasMB: mirrorDetail.bytes() / (1024*1024), textureMB: stream.textureMB() + folioShelf.textureMB() + furniture.textureMB(),
      pending: stream.pending() + folioShelf.pending() + furniture.library.pending() + Number(preparing) + Number(warming !== null), errors: [...stream.errors(), ...folioShelf.errors()],
      physicalReference: LEAF,
      transcription_it: pages[index]?.transcription_it,
      translation_fr: pages[index]?.translation_fr,
      panel: includeText ? panel.element.innerText : '',
      displayedPages: (paperOnlyMode ? (singleLeaf.visible && rightTexture ? [readingPage] : []) : [left, right, moving]).filter(mesh => mesh.visible).map(mesh => ({name:mesh.name, file:mesh.userData['page'], manifestId:mesh.userData['manifestId'], reverseFile:mesh === moving ? (direction > 0 ? turnBack.value : turnFront.value).userData['page'] : null})),
      manifestEntries: includeText ? stream.entries().map(e => ({id:e.id,class:e.class,licence:e.licence})) : [],
    }),
    manifest: () => [...stream.entries(), ...folioShelf.manifest(), ...furniture.library.manifest(), ...manifest.all.filter(e => e.id.startsWith('vinci/table-'))],
    get page() { return paperOnlyMode ? readingPage : moving.visible ? moving : right },
    dispose() {
      alive = false
      serial++
      cancelPrewarm?.()
      cancelTurn()
      folioShelf.dispose()
      stream.dispose()
      panel.dispose()
      mirrorDetail.dispose()
      front.dispose(); facing.dispose(); reflected.dispose(); turningMaterial.dispose()
      furniture.dispose()
    },
  }
  tables.set(object, api)
  return api
}

export type ReadingTable = ReturnType<typeof buildTable>
