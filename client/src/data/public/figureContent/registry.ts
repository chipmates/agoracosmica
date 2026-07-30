// Aggregates every per-figure fragment. figureQA.ts and figurePageContent.ts
// consult this registry first and fall back to their legacy tables.
import type { FigureFragment } from './types';
import { fragment as laozi } from './laozi';
import { fragment as angelou } from './angelou';
import { fragment as austen } from './austen';
import { fragment as aurelius } from './aurelius';
import { fragment as beauvoir } from './beauvoir';
import { fragment as bingen } from './bingen';
import { fragment as campbell } from './campbell';
import { fragment as zenji } from './zenji';
import { fragment as dickinson } from './dickinson';
import { fragment as einstein } from './einstein';
import { fragment as eckhart } from './eckhart';
import { fragment as galilei } from './galilei';
import { fragment as gandhi } from './gandhi';
import { fragment as goethe } from './goethe';
import { fragment as gautama } from './gautama';
import { fragment as jung } from './jung';
import { fragment as kahlo } from './kahlo';
import { fragment as king } from './king';
import { fragment as lovelace } from './lovelace';
import { fragment as mandela } from './mandela';
import { fragment as mozart } from './mozart';
import { fragment as blake } from './blake';
import { fragment as nietzsche } from './nietzsche';
import { fragment as plato } from './plato';
import { fragment as rumi } from './rumi';
import { fragment as schopenhauer } from './schopenhauer';
import { fragment as shakespeare } from './shakespeare';
import { fragment as woolf } from './woolf';
import { fragment as tubman } from './tubman';
import { fragment as vinci } from './vinci';

export const fragments: Record<string, FigureFragment> = {
  laozi,
  angelou,
  austen,
  aurelius,
  beauvoir,
  bingen,
  campbell,
  zenji,
  dickinson,
  einstein,
  eckhart,
  galilei,
  gandhi,
  goethe,
  gautama,
  jung,
  kahlo,
  king,
  lovelace,
  mandela,
  mozart,
  blake,
  nietzsche,
  plato,
  rumi,
  schopenhauer,
  shakespeare,
  woolf,
  tubman,
  vinci,
};
