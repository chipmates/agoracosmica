// The dashboard's Content-Security-Policy. Its one inline script and one inline
// style are allowed by their SHA-256, worked out from the page as served (the
// launch epoch is filled in first), so no other script can run in the page.
// Style attributes stay allowed: the charts set widths and colours in them, and
// with img-src and font-src closed a style cannot fetch anything.

const held = new Map<string, string>();

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let bin = '';
  for (const b of digest) bin += String.fromCharCode(b);
  return "'sha256-" + btoa(bin) + "'";
}

async function hashesOf(html: string, tag: 'script' | 'style'): Promise<string[]> {
  const out: string[] = [];
  const re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g');
  for (let m = re.exec(html); m; m = re.exec(html)) out.push(await sha256(m[1]));
  return out;
}

export async function dashboardPolicy(html: string): Promise<string> {
  const known = held.get(html);
  if (known) return known;
  const scripts = await hashesOf(html, 'script');
  const styles = await hashesOf(html, 'style');
  const policy = [
    "default-src 'none'",
    'script-src ' + (scripts.join(' ') || "'none'"),
    'style-src ' + styles.join(' ') + ' https://fonts.googleapis.com',
    "style-src-attr 'unsafe-inline'",
    'font-src https://fonts.gstatic.com',
    'img-src data:',
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  if (held.size > 4) held.clear();
  held.set(html, policy);
  return policy;
}
