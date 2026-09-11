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
