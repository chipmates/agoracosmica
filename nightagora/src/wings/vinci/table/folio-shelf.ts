import { BoxGeometry, CanvasTexture, ClampToEdgeWrapping, Group, LinearFilter, Matrix4, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type BufferGeometry, type Material, type Texture } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { ManifestIndex } from '../../../manifest'
import { FAMOUS_FOLIOS, folioKey, type PageRecord } from './content'
import { createPageStream } from './stream'

const RECIPE_ID = 'vinci/table-folio-shelf'
const CARD_WIDTH = 0.065
const CARD_HEIGHT = 0.085
const FRAME_WIDTH = 0.076
const FRAME_HEIGHT = 0.097
const TILT = -0.78
const ATLAS_SIZE = 1024
const CELL_WIDTH = 256
const CELL_HEIGHT = 512

/** A modern, two-level rack of admitted reading copies. The named folio
 * controls remain semantic DOM in the existing panel; no labels are baked
 * into these scans. Neither rack nor reduction is claimed as an original.
 */
export function buildFolioShelf(
  pages: PageRecord[], manifest: ManifestIndex,
  materials: { wood: Material; backing: Material },
) {
  const records = FAMOUS_FOLIOS.map(famous => {
    const record = pages.find(page => page.page_kind === 'facsimile' && folioKey(page) === `B:${famous.folio}`)
    if (!record) throw new Error(`No admitted manuscript-page record for shelf folio B ${famous.folio}`)
    return record
  })
  const stream = createPageStream(manifest)
  stream.pinThumbnails(records.map(record => record.file))
  const object = new Group()
  object.name = 'named-folio-reading-rack'
  object.visible = false
  object.userData['manifestId'] = RECIPE_ID
  object.userData['assetClass'] = 'GENERATED'
  const oakParts: BufferGeometry[] = [], backingParts: BufferGeometry[] = []
  const ownedGeometry: BufferGeometry[] = []
  const cardCenters: Vector3[] = []
  const failures = new Set<string>()
  let cardMaterial: MeshStandardNodeMaterial | null = null
  let atlas: CanvasTexture | null = null
  let atlasCanvas: HTMLCanvasElement | null = null
  const rotation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), TILT)
  const unit = new Vector3(1, 1, 1)
  let alive = true, requested = false, assembling = false

  function timber(width: number, height: number, depth: number, x: number, y: number, z: number) {
    const part = new BoxGeometry(width, height, depth)
    part.translate(x, y, z)
    oakParts.push(part)
  }
  // Feet meet the table at y=-4.5 mm. The stepped rails put both rows in
  // view from the reading camera and leave the lamp's arm entirely clear.
  for (const x of [-0.216, 0.216]) {
    timber(0.012, 0.008, 0.237, x, -0.0005, -0.339)
    timber(0.012, 0.091, 0.014, x, 0.045, -0.434)
  }
  timber(0.444, 0.009, 0.077, 0, 0.024, -0.273)
  timber(0.444, 0.009, 0.077, 0, 0.094, -0.400)
  timber(0.444, 0.012, 0.006, 0, 0.0345, -0.232)
  timber(0.444, 0.012, 0.006, 0, 0.1045, -0.359)

  for (let index = 0; index < records.length; index++) {
    const row = Math.floor(index / 4), column = index % 4
    const center = new Vector3((column - 1.5) * 0.102, row ? 0.137 : 0.067, row ? -0.400 : -0.273)
    const transform = new Matrix4().compose(center, rotation, unit)
    const backing = new BoxGeometry(FRAME_WIDTH, FRAME_HEIGHT, 0.0024)
    backing.applyMatrix4(transform)
    backingParts.push(backing)

    for (const x of [-1, 1]) {
      const edge = new BoxGeometry(0.003, FRAME_HEIGHT, 0.0028)
      edge.translate(x * (FRAME_WIDTH - 0.003) / 2, 0, 0.0015)
      edge.applyMatrix4(transform)
      oakParts.push(edge)
    }
    for (const y of [-1, 1]) {
      const edge = new BoxGeometry(FRAME_WIDTH - 0.006, 0.003, 0.0028)
      edge.translate(0, y * (FRAME_HEIGHT - 0.003) / 2, 0.0015)
      edge.applyMatrix4(transform)
      oakParts.push(edge)
    }

    cardCenters.push(center.clone().add(new Vector3(0, 0, 0.0014).applyQuaternion(rotation)))
  }

  for (const [parts, material, name] of [
    [oakParts, materials.wood, 'oak-folio-rack-and-frames'],
    [backingParts, materials.backing, 'folio-card-backs'],
  ] as const) {
    const geometry = mergeGeometries(parts, false)
    parts.forEach(part => part.dispose())
    if (!geometry) throw new Error(`Could not merge ${name}`)
    ownedGeometry.push(geometry)
    const carrier = new Mesh(geometry, material)
    carrier.name = name
    carrier.receiveShadow = true
    carrier.userData['manifestId'] = RECIPE_ID
    carrier.userData['assetClass'] = 'GENERATED'
    object.add(carrier)
  }

  function assembleCards(textures: Texture[]) {
    if (!alive) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = ATLAS_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create the shelf facsimile atlas')
    atlasCanvas = canvas
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const parts: BufferGeometry[] = []
    const sources = textures.map((texture, index) => {
      const image = texture.image as ImageBitmap
      const column = index % 4, row = Math.floor(index / 4)
      const x = column * CELL_WIDTH, y = row * CELL_HEIGHT
      // The admitted bitmap is already vertically oriented for flipY=false
      // by the page stream. Preserve that orientation in each atlas cell.
      // Its full rectangle fills the cell; the physical plane below keeps
      // the source aspect, so no printed margin is cropped or stretched.
      context.drawImage(image, x, y, CELL_WIDTH, CELL_HEIGHT)
      const aspect = image.width / image.height
      const height = Math.min(CARD_HEIGHT, CARD_WIDTH / aspect)
      const geometry = new PlaneGeometry(height * aspect, height)
      const uv = geometry.getAttribute('uv')
      // Half-texel insets keep the linear filter inside this source's cell.
      const u0 = (x + 0.5) / ATLAS_SIZE, v0 = (y + 0.5) / ATLAS_SIZE
      const du = (CELL_WIDTH - 1) / ATLAS_SIZE, dv = (CELL_HEIGHT - 1) / ATLAS_SIZE
      for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex,
        u0 + uv.getX(vertex) * du, v0 + uv.getY(vertex) * dv)
      geometry.applyMatrix4(new Matrix4().compose(cardCenters[index]!, rotation, unit))
      parts.push(geometry)
      return {
        folio: `B:${FAMOUS_FOLIOS[index]!.folio}`,
        page: texture.userData['page'], manifestId: texture.userData['manifestId'],
        licence: texture.userData['licence'], assetClass: 'PD-ART',
        atlasCell: { x, y, width: CELL_WIDTH, height: CELL_HEIGHT },
        sourcePixels: { width: image.width, height: image.height },
        indexStart: index * 6, indexCount: 6,
      }
    })
    const geometry = mergeGeometries(parts, false)
    parts.forEach(part => part.dispose())
    if (!geometry) throw new Error('Could not merge the eight shelf facsimiles')
    ownedGeometry.push(geometry)
    atlas = new CanvasTexture(canvas)
    atlas.name = 'shelf-facsimile-atlas'
    atlas.colorSpace = SRGBColorSpace
    atlas.flipY = false
    atlas.wrapS = atlas.wrapT = ClampToEdgeWrapping
    atlas.minFilter = atlas.magFilter = LinearFilter
    atlas.generateMipmaps = false
    atlas.userData['manifestId'] = RECIPE_ID
    atlas.userData['assetClass'] = 'GENERATED'
    atlas.userData['sourcePages'] = sources
    atlas.userData['sourceManifestIds'] = sources.map(source => source.manifestId)
    cardMaterial = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.15, map: atlas })
    const cards = new Mesh(geometry, cardMaterial)
    cards.name = 'eight-shelf-facsimiles'
    cards.receiveShadow = true
    cards.userData['manifestId'] = RECIPE_ID
    cards.userData['assetClass'] = 'GENERATED'
    cards.userData['sourcePages'] = sources
    cards.userData['sourceManifestIds'] = sources.map(source => source.manifestId)
    object.userData['atlasReady'] = true
    // Publish one complete card mesh only after all eight source images exist.
    object.add(cards)
  }

  return {
    object,
    setVisible(on: boolean) {
      if (!alive) return
      object.visible = on
      if (!on || requested) return
      requested = true
      assembling = true
      // Keep the eight source entries and their pinned thumbnails for the
      // evidence drawer. The generated atlas adds exactly 4 MiB without mips.
      // Shelf visibility never requests or retains a 2K source plate.
      void Promise.all(records.map(record => stream.load(record.file, false))).then(assembleCards).catch(error => {
        if (alive) failures.add(String(error))
      }).finally(() => {
        assembling = false
      })
    },
    pending: () => stream.pending() + Number(assembling),
    textureMB: () => stream.textureMB() + (atlas ? ATLAS_SIZE * ATLAS_SIZE * 4 / (1024 * 1024) : 0),
    errors: () => [...stream.errors(), ...failures],
    manifest: () => [
      ...stream.entries(),
      ...manifest.all.filter(entry => entry.id === RECIPE_ID),
    ],
    dispose() {
      if (!alive) return
      alive = false
      object.visible = false
      stream.dispose()
      ownedGeometry.forEach(geometry => geometry.dispose())
      cardMaterial?.dispose()
      atlas?.dispose()
      atlas = null
      if (atlasCanvas) atlasCanvas.width = atlasCanvas.height = 0
      atlasCanvas = null
      object.clear()
    },
  }
}
