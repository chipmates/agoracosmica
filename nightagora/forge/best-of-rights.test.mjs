// node --test forge/best-of-rights.test.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { CARRIED, carryRights, embeddedRights, jpegSegments, profileName, withoutRights, xmpPacket, xmpRights } from './best-of-rights.mjs'
import { STORE } from './vite-na-assets.mjs'

/* ---- files built by hand: a reader of segments needs no picture ---- */

const segment = (marker, data) => {
  const head = Buffer.from([0xff, marker, 0, 0])
  head.writeUInt16BE(data.length + 2, 2)
  return Buffer.concat([head, data])
}
const latin = text => Buffer.from(text, 'latin1')
const jpeg = (...segments) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments,
  segment(0xdb, Buffer.alloc(65, 1)), Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 4, 0xff, 0xd9])])
const JFIF = segment(0xe0, latin('JFIF\0\x01\x01\x00\x00\x01\x00\x01\x00\x00'))
const xmp = packet => segment(0xe1, Buffer.concat([latin('http://ns.adobe.com/xap/1.0/\0'), Buffer.from(packet, 'utf8')]))

const NOTICE = '© Example Agency ( Example Library) / First Maker - Second Maker'
const PACKET = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?> <x:xmpmeta xmlns:x="adobe:ns:meta/"> <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
  + ` <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"`
  + ` xmp:CreatorTool="A tool" xmpRights:WebStatement="http://example.org/terms?a=1&amp;b=2" xmpRights:Marked="True">`
  + ` <dc:rights> <rdf:Alt> <rdf:li xml:lang="x-default">${NOTICE}</rdf:li> </rdf:Alt> </dc:rights>`
  + ` </rdf:Description> </rdf:RDF> </x:xmpmeta>   <?xpacket end="w"?>`

/** one Photoshop resource */
const resource = (id, data) => {
  const head = Buffer.concat([latin('8BIM'), Buffer.from([id >> 8, id & 0xff, 0, 0]), Buffer.alloc(4)])
  head.writeUInt32BE(data.length, 8)
  return Buffer.concat([head, data, Buffer.alloc(data.length % 2)])
}
const dataset = (record, number, data) => {
  const head = Buffer.from([0x1c, record, number, 0, 0])
  head.writeUInt16BE(data.length, 3)
  return Buffer.concat([head, data])
}
const irb = (...resources) => segment(0xed, Buffer.concat([latin('Photoshop 3.0\0'), ...resources]))

/** a TIFF header and one IFD of ASCII entries */
function exif(entries) {
  const count = entries.length
  const ifd = Buffer.alloc(2 + count * 12 + 4)
  ifd.writeUInt16BE(count, 0)
  let extra = Buffer.alloc(0)
  entries.forEach(([tag, text], i) => {
    const value = Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([0])])
    const at = 2 + i * 12
    ifd.writeUInt16BE(tag, at); ifd.writeUInt16BE(2, at + 2); ifd.writeUInt32BE(value.length, at + 4)
    ifd.writeUInt32BE(8 + ifd.length + extra.length, at + 8)
    extra = Buffer.concat([extra, value])
  })
  return segment(0xe1, Buffer.concat([latin('Exif\0\0'), latin('MM'), Buffer.from([0, 42, 0, 0, 0, 8]), ifd, extra]))
}

/** a colour profile that names itself, as version 2 profiles do */
function icc(name) {
  const desc = Buffer.concat([latin('desc'), Buffer.alloc(4), Buffer.alloc(4), latin(`${name}\0`)])
  desc.writeUInt32BE(name.length + 1, 8)
  const head = Buffer.alloc(128 + 4 + 12)
  head.writeUInt32BE(1, 128)
  head.write('desc', 132, 'latin1'); head.writeUInt32BE(head.length, 136); head.writeUInt32BE(desc.length, 140)
  return segment(0xe2, Buffer.concat([latin('ICC_PROFILE\0'), Buffer.from([1, 1]), head, desc]))
}

/* ---- reading ---- */

test('an XMP notice is read word for word, attributes and elements alike', () => {
  const read = embeddedRights(jpeg(JFIF, xmp(PACKET)))
  assert.deepEqual(read.fields, { 'dc:rights': NOTICE, 'xmpRights:Marked': 'True', 'xmpRights:WebStatement': 'http://example.org/terms?a=1&b=2' })
  assert.equal(read.notice, NOTICE)
  assert.deepEqual(read.unread, [])
})

test('the namespace decides, not the prefix a packet happens to use', () => {
  const packet = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description xmlns:a="http://purl.org/dc/elements/1.1/" xmlns:dc="http://example.org/not-dublin-core/" xmlns:r="http://ns.adobe.com/xap/1.0/rights/">'
    + '<dc:rights>not a rights line</dc:rights><a:rights><rdf:Alt><rdf:li xml:lang="fr">Tous droits</rdf:li><rdf:li xml:lang="x-default">All rights &lt;held&gt;</rdf:li></rdf:Alt></a:rights>'
    + '<a:creator><rdf:Seq><rdf:li>One</rdf:li><rdf:li>Two</rdf:li></rdf:Seq></a:creator><r:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">Ask first</rdf:li></rdf:Alt></r:UsageTerms>'
    + '</rdf:Description></rdf:RDF></x:xmpmeta>'
  assert.deepEqual(xmpRights(packet), { 'dc:rights': ['All rights <held>', 'Tous droits'], 'dc:creator': ['One', 'Two'], 'xmpRights:UsageTerms': 'Ask first' })
  assert.equal(embeddedRights(jpeg(xmp(packet))).notice, 'All rights <held>')
})

test('a file that states nothing reads as nothing, never as a guess', () => {
  const read = embeddedRights(jpeg(JFIF, icc('Some RGB')))
  assert.deepEqual(read.fields, {})
  assert.equal(read.notice, null)
  // a packet with no rights field in it is no notice either
  assert.equal(embeddedRights(jpeg(xmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:format="image/jpeg"/></rdf:RDF></x:xmpmeta>'))).notice, null)
  assert.throws(() => embeddedRights(Buffer.from('not a picture')), /not a JPEG/)
})

test('the IIM by-line, credit and copyright notice are read, in the file\'s own encoding', () => {
  const utf8 = dataset(1, 90, Buffer.from([0x1b, 0x25, 0x47]))
  const file = jpeg(irb(resource(0x040c, Buffer.alloc(7, 9)), resource(0x0404, Buffer.concat([utf8, dataset(2, 5, latin('A title')),
    dataset(2, 80, Buffer.from('Première', 'utf8')), dataset(2, 80, latin('Second')), dataset(2, 110, latin('An agency')), dataset(2, 116, Buffer.from('© Une agence', 'utf8'))]))))
  const read = embeddedRights(file)
  assert.deepEqual(read.fields, { 'iptc:By-line': ['Première', 'Second'], 'iptc:Credit': 'An agency', 'iptc:CopyrightNotice': '© Une agence' })
  assert.equal(read.notice, '© Une agence')
  // without the character set, a Latin-1 notice is still read as written
  assert.equal(embeddedRights(jpeg(irb(resource(0x0404, dataset(2, 116, latin('© Une agence')))))).notice, '© Une agence')
})

test('the EXIF copyright and artist are read, and an XMP notice stands before them', () => {
  const tags = exif([[0x013b, 'A maker'], [0x8298, 'Copyright of a maker']])
  assert.deepEqual(embeddedRights(jpeg(tags)).fields, { 'exif:Artist': 'A maker', 'exif:Copyright': 'Copyright of a maker' })
  assert.equal(embeddedRights(jpeg(tags)).notice, 'Copyright of a maker')
  assert.equal(embeddedRights(jpeg(tags, xmp(PACKET))).notice, NOTICE)
  assert.equal(CARRIED('exif:Copyright'), false)
  assert.equal(CARRIED('dc:rights'), true)
})

test('an extended XMP packet is named as unread', () => {
  const extended = segment(0xe1, Buffer.concat([latin('http://ns.adobe.com/xmp/extension/\0'), Buffer.alloc(40)]))
  assert.deepEqual(embeddedRights(jpeg(xmp(PACKET), extended)).unread, ['an extended XMP packet'])
})

/* ---- carrying ---- */

test('a preview keeps its source\'s XMP packet whole, and its own picture data untouched', () => {
  const source = jpeg(JFIF, icc('Some RGB'), xmp(PACKET))
  const preview = jpeg(icc('Some RGB'))
  const kept = carryRights(preview, source)
  assert.equal(xmpPacket(kept), xmpPacket(source))
  assert.deepEqual(embeddedRights(kept).fields, embeddedRights(source).fields)
  // the packet stands after the preview's profile and before its tables
  assert.deepEqual(jpegSegments(kept).map(s => s.marker), [0xe2, 0xe1, 0xdb])
  assert.ok(withoutRights(kept).equals(preview))
  assert.equal(kept.length, preview.length + jpegSegments(source).find(s => s.marker === 0xe1).end - jpegSegments(source).find(s => s.marker === 0xe1).at)
})

test('a source that states nothing leaves the preview as it came', () => {
  const preview = jpeg(icc('Some RGB'))
  assert.equal(carryRights(preview, jpeg(JFIF, icc('Some RGB'))), preview)
  // a packet with no rights field in it is not carried
  assert.equal(carryRights(preview, jpeg(xmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:format="image/jpeg"/></rdf:RDF></x:xmpmeta>'))), preview)
})

test('only the IIM rights datasets are carried, as they stand', () => {
  const utf8 = dataset(1, 90, Buffer.from([0x1b, 0x25, 0x47]))
  const source = jpeg(irb(resource(0x040c, Buffer.alloc(7, 9)), resource(0x0404, Buffer.concat([utf8, dataset(2, 5, latin('A title')),
    dataset(2, 80, Buffer.from('Première', 'utf8')), dataset(2, 116, Buffer.from('© Une agence', 'utf8'))]))))
  const preview = jpeg(JFIF)
  const kept = carryRights(preview, source)
  assert.deepEqual(embeddedRights(kept).fields, { 'iptc:By-line': 'Première', 'iptc:CopyrightNotice': '© Une agence' })
  assert.equal(kept.includes(latin('A title')), false)
  assert.equal(kept.includes(Buffer.alloc(7, 9)), false)
  assert.ok(withoutRights(kept).equals(preview))
})

test('a preview that already carries a packet is refused, never given two', () => {
  const source = jpeg(xmp(PACKET))
  assert.throws(() => carryRights(carryRights(jpeg(JFIF), source), source), /already carries/)
})

test('a colour profile is named by its own description', () => {
  assert.equal(profileName(jpeg(JFIF, icc('Some RGB (1998)'))), 'Some RGB (1998)')
  assert.equal(profileName(jpeg(JFIF)), null)
})

/* ---- the store, where one stands beside the tree ---- */

const MANIFEST = join(STORE, 'wing-vinci', 'manifest.json')
const records = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : []
const noticed = records.filter(record => record.rights_notice !== undefined)

test('every notice a record carries is its file\'s own, word for word', { skip: noticed.length ? false : 'no store beside the tree, or no record with a notice yet' }, () => {
  const byId = new Map(records.map(record => [record.id, record]))
  for (const record of noticed) {
    if (record.path.endsWith('/')) {
      // a pyramid's tiles carry no metadata: its notice is its source's
      assert.equal(record.rights_notice, byId.get(record.derived_from)?.rights_notice, `${record.id}: not its source's notice`)
      continue
    }
    assert.equal(embeddedRights(readFileSync(join(STORE, 'wing-vinci', record.path))).notice, record.rights_notice, `${record.id}: not the file's own notice`)
  }
})

test('no stored scan carries a notice its record leaves out', { skip: noticed.length ? false : 'no store beside the tree, or no record with a notice yet' }, () => {
  for (const record of records) {
    if (record.role !== 'codex-page' && record.role !== 'codex-thumb') continue
    if (record.rights_notice !== undefined || !record.path.endsWith('.jpg')) continue
    const file = join(STORE, 'wing-vinci', record.path)
    if (existsSync(file)) assert.equal(embeddedRights(readFileSync(file)).notice, null, `${record.id}: its file carries a notice the record does not`)
  }
})
