/** The wheel's final lettering seat. Copy and star positions belong to the
 * register; this pass only places the existing, fully accessible controls. */
export interface SignPlace {
  x: number
  y: number
  half: number
  starX?: number
  starY?: number
  above?: boolean
  chip?: { slug: string; el: HTMLElement; leader: HTMLElement }
}

export function seatSigns(places: SignPlace[], width: number, height: number): void {
  const wide = width / height >= 0.9
  const title = document.getElementById('constellation-plate')?.getBoundingClientRect()
  const seated: SignPlace[] = []
  for (const p of places) {
    if (!p.chip || p.starX === undefined || p.starY === undefined) continue
    // The swan's names sit outside its feathers, like marginal lettering
    // around an atlas figure. Leaders keep every name on its own bone.
    if (wide) {
      if (p.chip.slug === 'goethe') {
        p.x = p.starX + p.half + 88
        p.y = p.starY + 70
      } else if (p.chip.slug === 'woolf') {
        p.x = p.starX - p.half - 90
        p.y = p.starY + 18
      } else if (p.chip.slug === 'dickinson') {
        p.x = p.starX + p.half + 92
        p.y = p.starY - 24
      } else if (p.chip.slug === 'angelou') {
        p.y = p.starY - 62
      }
    } else if (p.chip.slug === 'woolf') {
      p.x = p.starX - 36
      p.y = p.starY + 50
    }
    // A title is part of the plate, with its own unprinted paper. At a
    // turned view the lettering stays on the glass below that title.
    const oldX = p.x
    p.x = Math.max(p.half + 12, Math.min(width - p.half - 12, p.x))
    const hitsTitle = title && p.x + p.half > title.left - 12 &&
      p.x - p.half < title.right + 12 && p.y < title.bottom + 12 && p.y + 44 > title.top - 12
    const needsSeat = hitsTitle || oldX !== p.x || p.y < 16 || p.y > height - 142
    const preferredY = hitsTitle ? title.bottom + 16 : p.y
    const candidates = [0, 44, -44, 88, -88, 132, -132, 176, -176, 220, -220]
    for (const shift of needsSeat ? candidates : []) {
      const y = Math.max(16, Math.min(height - 142, preferredY + shift))
      const inTitle = title && p.x + p.half > title.left - 12 &&
        p.x - p.half < title.right + 12 && y < title.bottom + 12 && y + 44 > title.top - 12
      const inName = seated.some(q => Math.abs(q.x - p.x) < q.half + p.half + 10 && Math.abs(q.y - y) < 44)
      const onStar = places.some(q => q.starX !== undefined && q.starY !== undefined &&
        Math.abs(q.starX - p.x) < p.half + 8 && Math.abs(q.starY - y - 22) < 15)
      if (!inTitle && !inName && !onStar) { p.y = y; break }
    }
    // Pixel seats keep the letterpress still after the wheel settles.
    p.x = Math.round(p.x)
    p.y = Math.round(p.y)
    seated.push(p)
    p.chip.el.style.left = `${p.x}px`
    p.chip.el.style.top = `${p.y}px`
    const attach = p.starY > p.y + 22 ? 32 : 12
    const dx = p.starX - p.x
    const dy = p.starY - p.y - attach
    p.chip.leader.style.top = `${attach}px`
    p.chip.leader.style.width = `${Math.max(0, Math.hypot(dx, dy) - 11)}px`
    p.chip.leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
  }
}
