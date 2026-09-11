// WHOSE SERVER ANSWERED. A rig that shoots a port and trusts whatever
// replies has lied at least three times this year: a stale dev server left
// running on the same port from another checkout answers instantly, every
// frame looks plausible, and the round is judged against code nobody wrote
// today. So the dev and preview servers both say who they are, and the rig
// refuses to shoot a server whose answer does not match its own path.
import { execSync } from 'node:child_process'

function identity(root) {
  let head = 'unknown'
  try {
    head = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    /* not a checkout: the rig will say so rather than guess */
  }
  return JSON.stringify({ head, cwd: process.cwd(), root, pid: process.pid })
}

export function forgeWhoami() {
  const serve = (server) => {
    const body = identity(server.config.root)
    server.middlewares.use('/__forge/whoami', (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'no-store')
      res.end(body)
    })
  }
  return {
    name: 'forge-whoami',
    apply: 'serve',
    configureServer: serve,
    configurePreviewServer: serve,
  }
}
