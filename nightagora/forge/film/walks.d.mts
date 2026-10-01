// The shape the page reads of `walks.mjs`, which stays plain JavaScript so its tests run in node.
export function walkedClip(
  nodes: Readonly<Record<string, { kind: string; exhibit?: string }>> | readonly { id: string; kind: string; exhibit?: string }[],
): (edge: { from: string; to: string; kinds: readonly string[] }) => boolean
