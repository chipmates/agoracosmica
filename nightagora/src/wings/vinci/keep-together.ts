/* A LINE BREAKS WHERE A READER EXPECTS IT: a separator stays with the word
   before it, so no line starts with one, and a measure stays whole
   ("177 × 151 cm"). Display only; it imports nothing, so it moves no film key. */
export function keepTogether(said: string): string {
  return said
    .replace(/ (·) /g, ' $1 ')
    .replace(/(\d) ?× ?(\d)/g, '$1 × $2')
    .replace(/(\d) (cm|mm|m|km)\b/g, '$1 $2')
}

/** every text a shown part carries, kept together as above */
export function keepTogetherIn(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const said = node.nodeValue ?? ''
    const kept = keepTogether(said)
    if (kept !== said) node.nodeValue = kept
  }
}
