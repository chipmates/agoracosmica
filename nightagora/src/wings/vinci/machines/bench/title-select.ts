/** Preserve a native select's keyboard, touch and assistive-technology behavior
 * while showing its exact selected title in a wrapping, decorative layer.
 * The caller still owns the select, its options, aria-label and change handler.
 */
export function wrapTitleSelect(select: HTMLSelectElement) {
  const element = document.createElement('span')
  element.className = 'bench-title-select'
  select.classList.add('bench-title-select-native')
  const value = document.createElement('span')
  value.className = 'bench-title-select-value'
  value.setAttribute('aria-hidden', 'true')
  const refresh = () => { value.textContent = select.selectedOptions.item(0)?.textContent ?? '' }
  select.addEventListener('change', refresh)
  element.append(select, value)
  refresh()
  return { element, refresh, dispose: () => select.removeEventListener('change', refresh) }
}
