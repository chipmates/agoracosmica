// THE ROOM, READ OFF THE LIVE PAGE. These functions run inside the page
// (Playwright serialises them), so they carry no imports: three's objects are
// read by their own duck-typed flags. The scene is found through three's own
// devtools hook, which every Scene and renderer announces itself to, so the
// app needs no export hook of its own.

/** Installed before the app's first script: collects every Scene and renderer. */
export function installSceneHook() {
  const seen = { scenes: [], renderers: [] }
  const hook = new EventTarget()
  hook.addEventListener('observe', (event) => {
    const it = event.detail
    if (it && it.isScene) seen.scenes.push(it)
    else if (it && (it.isWebGPURenderer || it.isRenderer || it.isWebGLRenderer)) seen.renderers.push(it)
  })
  window.__THREE_DEVTOOLS__ = hook
  window.__roomExport = seen
}

/** The inventory: every drawn mesh whose bounds meet the box, every light the
 * room holds, and every unique geometry and material they use. Geometry bytes
 * are not read here; `geometryData` fetches them one at a time. */
export function scanRoom(opts) {
  const seen = window.__roomExport
  if (!seen) throw new Error('the scene hook was not installed')
  const scene = seen.scenes.find((s) => s.getObjectByName(opts.marker))
  if (!scene) throw new Error(`no scene holds ${opts.marker}`)
  scene.updateMatrixWorld(true)
  const box = opts.box
  const meets = (min, max) =>
    min[0] <= box.max[0] && max[0] >= box.min[0] &&
    min[1] <= box.max[1] && max[1] >= box.min[1] &&
    min[2] <= box.max[2] && max[2] >= box.min[2]
  const mul = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
  const mat4 = (a, b) => {
    const o = new Array(16)
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
    return o
  }
  const worldBounds = (geometry, m) => {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const b = geometry.boundingBox
    if (!b || !Number.isFinite(b.min.x)) return null
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const p = mul(m, [x, y, z])
      for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]) }
    }
    return { min, max }
  }
  const pathOf = (o) => {
    const names = []
    for (let at = o; at && at !== scene; at = at.parent) names.push(at.name || at.type)
    return names.reverse()
  }
  const shown = (o) => {
    for (let at = o; at; at = at.parent) if (!at.visible) return false
    return true
  }
  const stampOf = (o) => {
    for (let at = o; at; at = at.parent) {
      const id = at.userData && (at.userData.manifestId || at.userData.naManifestId || at.userData.dossier)
      if (id) return String(id)
    }
    return null
  }
  const colour = (c) => (c && c.isColor ? [c.r, c.g, c.b] : null)
  const plain = (value, depth = 0) => {
    if (value === null || value === undefined) return value
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value
    if (depth > 2) return undefined
    if (Array.isArray(value)) return value.slice(0, 16).map((v) => plain(v, depth + 1))
    if (typeof value === 'object' && !value.isNode && !value.isTexture && !value.isObject3D) {
      const out = {}
      for (const [k, v] of Object.entries(value)) {
        const p = plain(v, depth + 1)
        if (p !== undefined) out[k] = p
      }
      return out
    }
    return undefined
  }
  const SLOTS = ['colorNode', 'normalNode', 'roughnessNode', 'metalnessNode', 'emissiveNode', 'opacityNode',
    'aoNode', 'positionNode', 'lightsNode', 'envNode', 'outputNode', 'fragmentNode', 'vertexNode',
    'thicknessColorNode', 'transmissionNode', 'iorNode', 'clearcoatNode', 'backdropNode', 'castShadowNode']
  const textures = {}
  const texRecord = (t) => {
    if (!t || !t.isTexture) return null
    if (!textures[t.uuid]) {
      const img = t.image
      textures[t.uuid] = {
        uuid: t.uuid, name: t.name, colorSpace: t.colorSpace, flipY: t.flipY,
        wrap: [t.wrapS, t.wrapT], repeat: [t.repeat.x, t.repeat.y], offset: [t.offset.x, t.offset.y],
        rotation: t.rotation, channel: t.channel,
        width: img ? img.width || img.videoWidth || 0 : 0, height: img ? img.height || img.videoHeight || 0 : 0,
        compressed: Boolean(t.isCompressedTexture), data: Boolean(t.isDataTexture),
      }
    }
    return t.uuid
  }
  const materials = {}
  const matRecord = (m) => {
    if (!materials[m.uuid]) {
      const slots = {}
      for (const s of SLOTS) if (m[s] !== null && m[s] !== undefined) slots[s] = m[s].type || m[s].constructor?.name || true
      materials[m.uuid] = {
        uuid: m.uuid, name: m.name, type: m.type, node: Boolean(m.isNodeMaterial),
        side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
        colorWrite: m.colorWrite, depthWrite: m.depthWrite, depthTest: m.depthTest, visible: m.visible,
        blending: m.blending, lit: m.lights === true, vertexColors: m.vertexColors, flatShading: m.flatShading,
        color: colour(m.color), emissive: colour(m.emissive), emissiveIntensity: m.emissiveIntensity,
        roughness: m.roughness, metalness: m.metalness,
        transmission: m.transmission, ior: m.ior, thickness: m.thickness,
        attenuationColor: colour(m.attenuationColor), attenuationDistance: m.attenuationDistance,
        clearcoat: m.clearcoat, clearcoatRoughness: m.clearcoatRoughness, sheen: m.sheen,
        map: texRecord(m.map), normalMap: texRecord(m.normalMap), roughnessMap: texRecord(m.roughnessMap),
        metalnessMap: texRecord(m.metalnessMap), aoMap: texRecord(m.aoMap), emissiveMap: texRecord(m.emissiveMap),
        alphaMap: texRecord(m.alphaMap),
        normalScale: m.normalScale ? [m.normalScale.x, m.normalScale.y] : null,
        slots, userData: plain(m.userData),
        steps: m.steps,
      }
    }
    return m.uuid
  }
  const geometries = {}
  const geoRecord = (g) => {
    if (!geometries[g.uuid]) {
      const attrs = {}
      for (const [k, a] of Object.entries(g.attributes)) attrs[k] = { itemSize: a.itemSize, count: a.count, normalized: a.normalized, interleaved: Boolean(a.isInterleavedBufferAttribute) }
      geometries[g.uuid] = {
        uuid: g.uuid, type: g.type, attributes: attrs,
        index: g.index ? g.index.count : null,
        drawRange: [g.drawRange.start, g.drawRange.count],
        groups: g.groups.map((x) => [x.start, x.count, x.materialIndex ?? 0]),
        morph: Object.keys(g.morphAttributes || {}).length,
      }
    }
    return g.uuid
  }
  const meshes = []
  const skipped = { hidden: 0, layer: 0, outside: 0, invisibleMaterial: 0, notMesh: 0, excluded: 0 }
  const exclude = opts.exclude || {}
  const excluded = {}
  const machineOf = (o) => {
    for (let at = o; at; at = at.parent) if (at.userData && at.userData.dossier) return String(at.userData.dossier)
    return null
  }
  const skippedNames = []
  let serial = 0
  scene.traverse((o) => {
    if (!o.isMesh) { if (o.isPoints || o.isLine || o.isSprite) skipped.notMesh++; return }
    if (!shown(o)) { skipped.hidden++; return }
    if ((o.layers.mask & 1) === 0) { skipped.layer++; skippedNames.push(`layer:${o.name}`); return }
    const g = o.geometry
    if (!g || !g.attributes || !g.attributes.position) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    if (list.every((m) => !m || m.visible === false || m.colorWrite === false)) {
      skipped.invisibleMaterial++; skippedNames.push(`nocolor:${o.name}`); return
    }
    const world = Array.from(o.matrixWorld.elements)
    const instances = []
    if (o.isInstancedMesh) {
      const a = o.instanceMatrix.array
      for (let i = 0; i < o.count; i++) instances.push(mat4(world, Array.from(a.slice(i * 16, i * 16 + 16))))
    } else instances.push(world)
    const bounds = instances.map((m) => worldBounds(g, m)).filter(Boolean)
    if (!bounds.length) return
    const min = [0, 1, 2].map((i) => Math.min(...bounds.map((b) => b.min[i])))
    const max = [0, 1, 2].map((i) => Math.max(...bounds.map((b) => b.max[i])))
    if (!meets(min, max)) { skipped.outside++; return }
    const stamp = stampOf(o)
    if (stamp && exclude[stamp]) { skipped.excluded++; excluded[stamp] = (excluded[stamp] || 0) + 1; return }
    meshes.push({
      serial: serial++, uuid: o.uuid, name: o.name, path: pathOf(o), stamp, machine: machineOf(o),
      geometry: geoRecord(g), materials: list.map((m) => (m ? matRecord(m) : null)),
      instances, instanced: Boolean(o.isInstancedMesh), bounds: { min, max },
      castShadow: o.castShadow, receiveShadow: o.receiveShadow, renderOrder: o.renderOrder,
      frustumCulled: o.frustumCulled, userData: plain(o.userData),
    })
  })
  const lights = []
  scene.traverse((o) => {
    if (!o.isLight) return
    const p = [o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]]
    const e = o.matrixWorld.elements
    const rec = {
      name: o.name, type: o.type, position: p, visible: o.visible, shown: shown(o),
      color: colour(o.color), intensity: o.intensity, distance: o.distance, decay: o.decay,
      castShadow: o.castShadow, userData: plain(o.userData),
      // local -Z in world, what a light or a camera looks down
      forward: [-e[8], -e[9], -e[10]].map((v, i, a) => v / Math.hypot(a[0], a[1], a[2])),
      up: [e[4], e[5], e[6]], right: [e[0], e[1], e[2]],
    }
    if (o.isSpotLight) {
      const t = o.target.matrixWorld.elements
      rec.target = [t[12], t[13], t[14]]
      rec.angle = o.angle; rec.penumbra = o.penumbra
    }
    if (o.isDirectionalLight) { const t = o.target.matrixWorld.elements; rec.target = [t[12], t[13], t[14]] }
    if (o.isRectAreaLight) { rec.width = o.width; rec.height = o.height }
    if (o.isHemisphereLight) rec.groundColor = colour(o.groundColor)
    if (o.shadow) {
      rec.shadow = { mapSize: [o.shadow.mapSize.x, o.shadow.mapSize.y], radius: o.shadow.radius, bias: o.shadow.bias,
        normalBias: o.shadow.normalBias, near: o.shadow.camera?.near, far: o.shadow.camera?.far, layers: o.shadow.camera?.layers?.mask }
    }
    const inBox = meets(p, p)
    rec.inBox = inBox
    lights.push(rec)
  })
  const bg = scene.background
  return {
    scene: { name: scene.name, uuid: scene.uuid, environmentIntensity: scene.environmentIntensity,
      backgroundIntensity: scene.backgroundIntensity, background: bg ? (bg.isColor ? ['colour', bg.r, bg.g, bg.b] : bg.type || 'texture') : null,
      backgroundNode: Boolean(scene.backgroundNode), environment: Boolean(scene.environment), environmentNode: Boolean(scene.environmentNode),
      fog: scene.fog ? scene.fog.type : null },
    meshes, materials, geometries, textures, lights, skipped, excluded, skippedNames: skippedNames.slice(0, 200),
    state: window.__forge?.state?.(),
  }
}

/** Which of the room's machines hold their parts, and how many meshes each. */
export function machinesStanding(slugs) {
  const seen = window.__roomExport
  const counts = Object.fromEntries(slugs.map((s) => [s, 0]))
  for (const scene of seen ? seen.scenes : []) {
    scene.traverse((o) => {
      if (!o.isMesh) return
      for (let at = o; at; at = at.parent) {
        const d = at.userData && at.userData.dossier
        if (d && d in counts) { counts[d]++; break }
      }
    })
  }
  return { counts, pending: window.__forge?.state?.().texturesPending ?? -1 }
}

/** What a node material's graphs are made of: the constant colours and
 * numbers they multiply by, the attributes and textures they read, and the
 * node kinds, per slot. A recipe is recognised by these, never guessed. */
export function materialGraphs(uuids) {
  const seen = window.__roomExport
  const found = new Map()
  for (const scene of seen.scenes) scene.traverse((o) => {
    if (!o.isMesh) return
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && uuids.includes(m.uuid)) found.set(m.uuid, m)
  })
  const out = {}
  for (const [uuid, m] of found) {
    const slots = {}
    for (const slot of ['colorNode', 'roughnessNode', 'normalNode', 'metalnessNode', 'emissiveNode', 'opacityNode', 'thicknessColorNode']) {
      const root = m[slot]
      if (!root) continue
      const consts = [], kinds = new Set(), attributes = new Set(), textures = new Set(), scopes = new Set()
      const visited = new Set()
      const walk = (n, depth) => {
        if (!n || typeof n !== 'object' || visited.has(n) || visited.size > 6000 || depth > 200) return
        visited.add(n)
        if (n.isConstNode) {
          const v = n.value
          if (typeof v === 'number') consts.push(Math.round(v * 1e6) / 1e6)
          else if (v && v.isColor) consts.push(['c', v.r, v.g, v.b].map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)))
          else if (v && v.isVector3) consts.push(['v3', v.x, v.y, v.z].map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)))
          else if (v && v.isVector2) consts.push(['v2', v.x, v.y].map((x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x)))
        }
        const kind = n.type || n.constructor?.name
        if (kind) kinds.add(kind)
        if (n.attributeName || n._attributeName) attributes.add(n.attributeName || n._attributeName)
        if (n.isTextureNode && n.value && n.value.name) textures.add(n.value.name)
        if (n.scope && typeof n.scope === 'string') scopes.add(`${kind}:${n.scope}`)
        try { for (const c of n.getChildren()) walk(c, depth + 1) } catch { /* a node without children */ }
      }
      walk(root, 0)
      slots[slot] = { consts, kinds: [...kinds], attributes: [...attributes], textures: [...textures], scopes: [...scopes], nodes: visited.size }
    }
    out[uuid] = slots
  }
  return out
}

/** One geometry's bytes as base64, each attribute read out as float32 (or
 * uint32 for the index) whatever its storage: interleaved, normalised or
 * integer attributes arrive as the numbers the shader saw. */
export function geometryData(uuid) {
  const seen = window.__roomExport
  let geometry = null
  for (const scene of seen.scenes) {
    scene.traverse((o) => { if (!geometry && o.isMesh && o.geometry && o.geometry.uuid === uuid) geometry = o.geometry })
    if (geometry) break
  }
  if (!geometry) throw new Error(`geometry ${uuid} is gone`)
  const b64 = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength)
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }
  const out = { attributes: {} }
  for (const [name, a] of Object.entries(geometry.attributes)) {
    if (!['position', 'normal', 'uv', 'color', 'collectionRole', 'collectionRoomRole', 'tone'].includes(name)) continue
    const f = new Float32Array(a.count * a.itemSize)
    const get = [a.getX, a.getY, a.getZ, a.getW]
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = get[k].call(a, i)
    out.attributes[name] = { itemSize: a.itemSize, count: a.count, data: b64(f) }
  }
  if (geometry.index) {
    const idx = new Uint32Array(geometry.index.count)
    for (let i = 0; i < idx.length; i++) idx[i] = geometry.index.getX(i)
    out.index = b64(idx)
  }
  return out
}

/** THE SKY AS THE ENGINE DRAWS IT: every mesh but the sky's own hidden, six
 * square views rendered from `eye` into a half-float target and read back in
 * linear light. The room is not in the picture; only what an opening shows. */
export async function captureSky(opts) {
  const seen = window.__roomExport
  const scene = seen.scenes.find((s) => s.getObjectByName(opts.marker))
  const renderer = seen.renderers[seen.renderers.length - 1]
  let sky = null, spot = null
  scene.traverse((o) => {
    if (!sky && o.isMesh && o.userData && o.userData.manifestId === opts.sky) sky = o
    if (!spot && o.isSpotLight && o.shadow && o.shadow.map) spot = o
  })
  if (!sky) throw new Error(`no mesh stamped ${opts.sky}`)
  const Camera = spot.shadow.camera.constructor
  const Target = spot.shadow.map.constructor
  const size = opts.size
  const target = new Target(size, size, { type: 1016 /* HalfFloatType */, depthBuffer: true })
  const camera = new Camera(90, 1, 0.1, 5000)
  camera.position.set(...opts.eye)
  const hidden = []
  scene.traverse((o) => {
    if (o === scene || !o.visible) return
    if (o.isMesh || o.isPoints || o.isLine || o.isSprite) {
      let keep = false
      for (let at = sky; at; at = at.parent) if (at === o) keep = true
      if (o !== sky && !keep) { o.visible = false; hidden.push(o) }
    }
  })
  const background = scene.background
  const faces = []
  // the six faces in the order and orientation of a cube map: +x -x +y -y +z -z
  const dirs = [[1, 0, 0, 0, -1, 0], [-1, 0, 0, 0, -1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, -1], [0, 0, 1, 0, -1, 0], [0, 0, -1, 0, -1, 0]]
  const half = (h) => {
    const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff
    if (e === 0) return s * Math.pow(2, -14) * (m / 1024)
    if (e === 31) return m ? NaN : s * Infinity
    return s * Math.pow(2, e - 15) * (1 + m / 1024)
  }
  const prevTarget = renderer.getRenderTarget()
  try {
    for (const d of dirs) {
      camera.up.set(d[3], d[4], d[5])
      camera.lookAt(opts.eye[0] + d[0], opts.eye[1] + d[1], opts.eye[2] + d[2])
      camera.updateMatrixWorld(true)
      camera.updateProjectionMatrix()
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      renderer.setRenderTarget(prevTarget)
      const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size)
      const f = new Float32Array(size * size * 4)
      if (raw instanceof Uint16Array) for (let i = 0; i < f.length; i++) f[i] = half(raw[i])
      else f.set(raw)
      const bytes = new Uint8Array(f.buffer)
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
      faces.push(btoa(s))
    }
  } finally {
    for (const o of hidden) o.visible = true
    scene.background = background
    target.dispose()
  }
  return { size, faces, background: background && background.isColor ? [background.r, background.g, background.b] : null }
}
