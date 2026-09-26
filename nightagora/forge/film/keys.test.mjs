// THE GLOBAL KEY COUNTS WHAT A FRAME CAN DRAW: a film or a poster written to
// the store leaves it, a texture the world binds moves it. On the store as it
// stands, read the way the gate reads it; no world is mounted.
//
//   node --test forge/film/keys.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BYTE_EXEMPT } from './film-check.mjs'
import { DELIVERY, clipDeliveryKey, deliveryKey, drawable, globalKey } from './keys.mjs'
import { createLoader } from './load.mjs'
import { libraryOf } from './scene.mjs'
import { mergeManifests } from '../vite-na-assets.mjs'

const loader = await createLoader()
const store = libraryOf(mergeManifests())
const keyOf = (library) => globalKey(loader, { library, claimed: new Set() }).key
const texture = store.find((e) => e.wing === 'library' && /\.(ktx2|jpg|png)$/.test(e.path ?? ''))

test('what a frame can draw, by the entry alone', () => {
  assert.equal(drawable({ path: 'showpieces/glass-heart/glass-heart-wide-1920x1080.mp4', role: 'showpiece-film' }), false)
  assert.equal(drawable({ path: 'showpieces/glass-heart/glass-heart-wide-poster.webp', role: 'showpiece-poster' }), false)
  assert.equal(drawable({ path: 'trailers/ambient.webm' }), false)
  assert.equal(drawable({ path: 'sounds/wind.mp3' }), false)
  assert.equal(drawable({ path: 'library/brick-old-red/albedo.ktx2' }), true)
  assert.equal(drawable({ path: 'wing-vinci/ms/leaf.jpg', role: 'ms-page' }), true)
})

test("the glass heart's films and posters leave the global key where it was", () => {
  const films = store.filter((e) => String(e.role ?? '').startsWith('showpiece-'))
  const without = store.filter((e) => !films.includes(e))
  // on a store that carries them already, and on one that never did
  if (films.length) assert.equal(keyOf(store), keyOf(without), 'the store with the heart keys as the store without it')
  const planted = [
    { id: 'vinci/showpiece/test/wide/1920x1080', wing: 'wing-vinci', path: 'showpieces/test/test-wide-1920x1080.mp4', sha256: 'f'.repeat(64), role: 'showpiece-film' },
    { id: 'vinci/showpiece/test/wide/poster', wing: 'wing-vinci', path: 'showpieces/test/test-wide-poster.webp', sha256: 'e'.repeat(64), role: 'showpiece-poster' },
    { id: 'library/ambient', wing: 'library', path: 'library/ambient.webm', sha256: 'd'.repeat(64) },
  ]
  assert.equal(keyOf([...without, ...planted]), keyOf(without), 'a film, a poster and a sound written to the store move nothing')
})

test('a texture the world binds moves the global key', () => {
  assert.ok(texture, 'the store holds a library texture')
  const moved = store.map((e) => (e === texture ? { ...e, sha256: '0'.repeat(64) } : e))
  const before = globalKey(loader, { library: store, claimed: new Set() })
  const after = globalKey(loader, { library: moved, claimed: new Set() })
  assert.notEqual(after.key, before.key, `${texture.path} rewritten moves the key`)
  assert.deepEqual(Object.keys(after.parts).filter((k) => after.parts[k] !== before.parts[k]), ['library sets no plate claims'])
  const added = [...store, { id: 'library/new-stone/albedo', wing: 'library', path: 'library/new-stone/albedo.ktx2', sha256: '1'.repeat(64) }]
  assert.notEqual(keyOf(added), keyOf(store), 'a texture added moves the key')
})

test("the delivery key moves for the grass's legs alone", () => {
  const plain = deliveryKey(DELIVERY)
  for (const clip of BYTE_EXEMPT.clips) {
    assert.notEqual(clipDeliveryKey(clip), plain, `${clip} names the exemption`)
    assert.equal(clipDeliveryKey(clip), clipDeliveryKey(clip, DELIVERY))
  }
  assert.equal(clipDeliveryKey(BYTE_EXEMPT.clips[0]), clipDeliveryKey(BYTE_EXEMPT.clips[1]), 'one exemption, one key')
  for (const clip of ['stop:study>stop:chamber', 'stop:garden>stop:garden-gate', 'view:machine/aerial-screw>view:machine/miter-lock-gates', ''])
    assert.equal(clipDeliveryKey(clip), plain, `${clip || 'no clip'} keeps the delivery's own key`)
  // the exemption is in the key: the delivery with no cap, said so
  assert.equal(clipDeliveryKey(BYTE_EXEMPT.clips[0]), deliveryKey({ ...DELIVERY, vbv: 'none: exempt from the byte line, encoded uncapped', byteCap: false }))
})
