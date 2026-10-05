/* THE RIGHTS A PICTURE FILE STATES ABOUT ITSELF, read from its own bytes, and
 * the same statement carried into a preview cut from it.
 *
 * A holder's file may name a photographer or an agency in its metadata. That
 * notice is part of the credit: it is read here word for word, never typed,
 * and a field the file does not carry is absent, never supplied.
 *
 * JPEG only. The main XMP packet is read; an extended packet (over 64 KB) is
 * not, and `embeddedRights` says so in `unread`.
 */

const XMP_HEAD = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1')
const XMP_EXTENSION = Buffer.from('http://ns.adobe.com/xmp/extension/\0', 'latin1')
const EXIF_HEAD = Buffer.from('Exif\0\0', 'latin1')
const IRB_HEAD = Buffer.from('Photoshop 3.0\0', 'latin1')
const ICC_HEAD = Buffer.from('ICC_PROFILE\0', 'latin1')

const NAMESPACES = {
  dc: 'http://purl.org/dc/elements/1.1/',
  photoshop: 'http://ns.adobe.com/photoshop/1.0/',
  xmpRights: 'http://ns.adobe.com/xap/1.0/rights/',
}
/** The XMP rights fields, by the name the standard gives each. */
const XMP_FIELDS = [
  ['dc', 'rights'], ['dc', 'creator'], ['photoshop', 'Credit'],
  ['xmpRights', 'Marked'], ['xmpRights', 'WebStatement'], ['xmpRights', 'UsageTerms'],
]
/** The IIM rights datasets of record 2, by number. */
const IPTC_FIELDS = { 80: 'iptc:By-line', 110: 'iptc:Credit', 116: 'iptc:CopyrightNotice' }
/** The EXIF rights tags of IFD0. */
const EXIF_FIELDS = { 0x013b: 'exif:Artist', 0x8298: 'exif:Copyright' }
/** Which field is the notice a credit prints, the first a file carries. */
export const NOTICE_FIELDS = ['dc:rights', 'iptc:CopyrightNotice', 'exif:Copyright']

/** Every segment before the picture's own data: { marker, at, end, data }. */
export function jpegSegments(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG')
  const out = []
  let at = 2
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0xff) { at++; continue }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue }
    const length = bytes.readUInt16BE(at + 2)
    out.push({ marker, at, end: at + 2 + length, data: bytes.subarray(at + 4, at + 2 + length) })
    at += 2 + length
  }
  return out
}
const starts = (data, head) => data.length >= head.length && data.subarray(0, head.length).equals(head)

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unescapeXml = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
  if (name[0] !== '#') return ENTITIES[name] ?? whole
  return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10))
})
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The rights fields of one XMP packet. A simple value is a string; a list
 * (`dc:creator`) or a set of language alternatives with more than one entry
 * (`dc:rights`) is an array in the packet's own order. */
export function xmpRights(packet) {
  const out = {}
  for (const [space, name] of XMP_FIELDS) {
    // a packet may bind a namespace to any prefix: the address decides
    const prefixes = [...packet.matchAll(/xmlns:([\w.-]+)\s*=\s*(["'])(.*?)\2/g)].filter(m => m[3] === NAMESPACES[space]).map(m => m[1])
    for (const prefix of new Set(prefixes)) {
      const tag = escapeRe(`${prefix}:${name}`)
      const element = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`).exec(packet)
      const attribute = new RegExp(`[\\s]${tag}\\s*=\\s*(["'])([\\s\\S]*?)\\1`).exec(packet)
      let value
      if (element) {
        const items = [...element[1].matchAll(/<rdf:li(\s[^>]*)?>([\s\S]*?)<\/rdf:li\s*>/g)]
        if (items.length) {
          // the default language first, where the alternatives name one
          const ordered = [...items.filter(m => /xml:lang\s*=\s*["']x-default["']/.test(m[1] ?? '')), ...items.filter(m => !/xml:lang\s*=\s*["']x-default["']/.test(m[1] ?? ''))]
          const values = ordered.map(m => unescapeXml(m[2]))
          value = values.length === 1 ? values[0] : values
        } else if (!/</.test(element[1])) value = unescapeXml(element[1])
      } else if (attribute) value = unescapeXml(attribute[2])
      if (value !== undefined && out[`${space}:${name}`] === undefined) out[`${space}:${name}`] = value
    }
  }
  return out
}

/** The IIM datasets of every Photoshop resource block a file carries. */
function iimDatasets(segments) {
  const blocks = segments.filter(s => s.marker === 0xed && starts(s.data, IRB_HEAD)).map(s => s.data.subarray(IRB_HEAD.length))
  if (!blocks.length) return []
  const irb = Buffer.concat(blocks)
  const sets = []
  let at = 0
  while (at + 12 <= irb.length && irb.toString('latin1', at, at + 4) === '8BIM') {
    const id = irb.readUInt16BE(at + 4)
    const nameLength = irb[at + 6]
    let from = at + 7 + nameLength
    if ((1 + nameLength) % 2) from++
    const size = irb.readUInt32BE(from)
    from += 4
    if (id === 0x0404) {
      let p = from
      const end = from + size
      while (p + 5 <= end && irb[p] === 0x1c) {
        const record = irb[p + 1], dataset = irb[p + 2]
        let length = irb.readUInt16BE(p + 3)
        let head = 5
        if (length & 0x8000) {
          // an extended dataset names its length in the octets that follow
          const octets = length & 0x7fff
          length = 0
          for (let i = 0; i < octets; i++) length = length * 256 + irb[p + 5 + i]
          head += octets
        }
        sets.push({ record, dataset, raw: irb.subarray(p, p + head + length), data: irb.subarray(p + head, p + head + length) })
        p += head + length
      }
    }
    at = from + size + (size % 2)
  }
  return sets
}
function iptcRights(sets) {
  const utf8 = sets.some(s => s.record === 1 && s.dataset === 90 && s.data.equals(Buffer.from([0x1b, 0x25, 0x47])))
  const decode = data => {
    if (utf8) return data.toString('utf8')
    const tried = data.toString('utf8')
    return tried.includes('�') ? data.toString('latin1') : tried
  }
  const out = {}
  for (const set of sets) {
    const name = set.record === 2 ? IPTC_FIELDS[set.dataset] : undefined
    if (!name) continue
    const value = decode(set.data)
    // a by-line may repeat, one dataset for each name
    out[name] = out[name] === undefined ? value : [].concat(out[name], value)
  }
  return out
}

function exifRights(data) {
  const tiff = data.subarray(EXIF_HEAD.length)
  const order = tiff.toString('latin1', 0, 2)
  if (order !== 'II' && order !== 'MM') return {}
  const little = order === 'II'
  const u16 = at => little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at)
  const u32 = at => little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at)
  const out = {}
  const ifd = u32(4)
  if (ifd + 2 > tiff.length) return out
  const count = u16(ifd)
  for (let i = 0; i < count; i++) {
    const at = ifd + 2 + i * 12
    if (at + 12 > tiff.length) break
    const name = EXIF_FIELDS[u16(at)]
    if (!name || u16(at + 2) !== 2) continue
    const length = u32(at + 4)
    const from = length <= 4 ? at + 8 : u32(at + 8)
    if (from + length > tiff.length) continue
    // a copyright may hold two names, the photographer's and the editor's, NUL between
    const value = tiff.subarray(from, from + length).toString('utf8').replace(/\0+$/, '').split('\0').join(' / ')
    if (value.trim()) out[name] = value
  }
  return out
}

/** The main XMP packet of a file, as text, or null. */
export function xmpPacket(bytes) {
  const segment = jpegSegments(bytes).find(s => s.marker === 0xe1 && starts(s.data, XMP_HEAD))
  return segment ? segment.data.subarray(XMP_HEAD.length).toString('utf8') : null
}

/** EVERY RIGHTS FIELD A FILE CARRIES, verbatim: `fields` by standard name,
 * `notice` the line a credit prints (null where the file names none), and
 * `unread` what this reader saw and could not read. */
export function embeddedRights(bytes) {
  const segments = jpegSegments(bytes)
  const fields = {}
  const unread = []
  const packet = xmpPacket(bytes)
  if (packet) Object.assign(fields, xmpRights(packet))
  if (segments.some(s => s.marker === 0xe1 && starts(s.data, XMP_EXTENSION))) unread.push('an extended XMP packet')
  Object.assign(fields, iptcRights(iimDatasets(segments)))
  const exif = segments.find(s => s.marker === 0xe1 && starts(s.data, EXIF_HEAD))
  if (exif) Object.assign(fields, exifRights(exif.data))
  const first = NOTICE_FIELDS.map(name => fields[name]).find(value => value !== undefined)
  const line = Array.isArray(first) ? first[0] : first
  return { fields, notice: typeof line === 'string' && line.trim() ? line : null, unread }
}

/** The fields a preview can keep: XMP and IIM. An EXIF-only statement is not carried. */
export const CARRIED = name => !name.startsWith('exif:')

/** A PREVIEW THAT KEEPS ITS SOURCE'S RIGHTS STATEMENT. The source's XMP
 * packet goes in whole, byte for byte, and its IIM rights datasets as they
 * stand; the picture's own data is not touched, so the pixels are the
 * preview's as encoded. A source that states nothing returns the preview as
 * it came. */
export function carryRights(preview, source) {
  const from = jpegSegments(source)
  const add = []
  const packet = from.find(s => s.marker === 0xe1 && starts(s.data, XMP_HEAD))
  if (packet && Object.keys(xmpRights(packet.data.subarray(XMP_HEAD.length).toString('utf8'))).length) add.push(source.subarray(packet.at, packet.end))
  const sets = iimDatasets(from)
  const kept = sets.filter(s => (s.record === 1 && s.dataset === 90) || (s.record === 2 && IPTC_FIELDS[s.dataset]))
  if (kept.some(s => s.record === 2)) {
    const iim = Buffer.concat(kept.map(s => s.raw))
    const resource = Buffer.concat([Buffer.from('8BIM', 'latin1'), Buffer.from([0x04, 0x04, 0, 0]), Buffer.alloc(4), iim, Buffer.alloc(iim.length % 2)])
    resource.writeUInt32BE(iim.length, 8)
    const data = Buffer.concat([IRB_HEAD, resource])
    if (data.length + 2 > 0xffff) throw new Error('the IIM rights datasets do not fit one segment')
    const head = Buffer.from([0xff, 0xed, 0, 0])
    head.writeUInt16BE(data.length + 2, 2)
    add.push(Buffer.concat([head, data]))
  }
  if (!add.length) return preview
  const own = jpegSegments(preview)
  if (own.some(s => (s.marker === 0xe1 && starts(s.data, XMP_HEAD)) || (s.marker === 0xed && starts(s.data, IRB_HEAD)))) throw new Error('the preview already carries a packet of its own')
  // after the file's own leading segments (JFIF, EXIF, its colour profile), before its tables
  const lead = own.filter(s => s.marker === 0xe0 || (s.marker === 0xe1 && starts(s.data, EXIF_HEAD)) || (s.marker === 0xe2 && starts(s.data, ICC_HEAD)))
  let at = 2
  for (const segment of lead) if (segment.at === at) at = segment.end
  return Buffer.concat([preview.subarray(0, at), ...add, preview.subarray(at)])
}

/** The same file with every XMP and IIM segment taken out: what is left is
 * the picture as encoded, for comparing two files' pixels by their bytes. */
export function withoutRights(bytes) {
  const drop = jpegSegments(bytes).filter(s => (s.marker === 0xe1 && (starts(s.data, XMP_HEAD) || starts(s.data, XMP_EXTENSION))) || (s.marker === 0xed && starts(s.data, IRB_HEAD)))
  if (!drop.length) return bytes
  const parts = []
  let at = 0
  for (const segment of drop) { parts.push(bytes.subarray(at, segment.at)); at = segment.end }
  parts.push(bytes.subarray(at))
  return Buffer.concat(parts)
}

/** The name an embedded colour profile gives itself, or null where a file carries none. */
export function profileName(bytes) {
  const chunks = jpegSegments(bytes).filter(s => s.marker === 0xe2 && starts(s.data, ICC_HEAD))
    .sort((a, b) => a.data[ICC_HEAD.length] - b.data[ICC_HEAD.length]).map(s => s.data.subarray(ICC_HEAD.length + 2))
  if (!chunks.length) return null
  const icc = Buffer.concat(chunks)
  const count = icc.readUInt32BE(128)
  for (let i = 0; i < count; i++) {
    const at = 132 + i * 12
    if (icc.toString('latin1', at, at + 4) !== 'desc') continue
    const from = icc.readUInt32BE(at + 4)
    const type = icc.toString('latin1', from, from + 4)
    if (type === 'desc') return icc.toString('latin1', from + 12, from + 12 + icc.readUInt32BE(from + 8)).replace(/\0+$/, '')
    if (type === 'mluc' && icc.readUInt32BE(from + 8) > 0) {
      const length = icc.readUInt32BE(from + 20), offset = icc.readUInt32BE(from + 24)
      return Buffer.from(icc.subarray(from + offset, from + offset + length)).swap16().toString('utf16le')
    }
  }
  return 'unnamed profile'
}
