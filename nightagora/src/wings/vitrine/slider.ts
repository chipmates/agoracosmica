/* THE CLOCK'S TRACK IS DRAWN, NOT LEFT TO THE ENGINE: WebKit ignores the
   accent colour on a range, so the gold run of the track is a gradient read
   from the value, the same in every engine. */
export function paintSlider(slider: HTMLInputElement): void {
  const min = Number(slider.min) || 0, max = Number(slider.max) || 100
  const share = max > min ? (Number(slider.value) - min) / (max - min) : 0
  slider.style.setProperty('--fill', `${Math.round(Math.min(1, Math.max(0, share)) * 1000) / 10}%`)
}
