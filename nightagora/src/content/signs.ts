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
  for (const p of places) {
    if (!p.chip || p.starX === undefined || p.starY === undefined) continue
    // First repair: the full Goethe name must not contain Dickinson's star.
    if (p.chip.slug === 'goethe' && width / height >= 0.9) {
      p.y = p.starY + 64
      p.above = false
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
