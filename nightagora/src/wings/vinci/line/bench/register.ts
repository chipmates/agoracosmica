import * as frame from '../../../frame'

export type TextRegister = 'label' | 'drawer' | 'record'

/** Use the shared contract when integrated; this bench predates that export.
 * The local fallback has the same DOM contract and does not change the shell. */
export function setRegister<T extends HTMLElement>(element:T, register:TextRegister):T {
  const shared = frame as typeof frame & {setRegister?: (element:HTMLElement, register:TextRegister) => void}
  if(shared.setRegister) shared.setRegister(element, register)
  else element.dataset['register'] = register
  return element
}
