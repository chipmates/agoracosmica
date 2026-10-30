// Networks of hosting and cloud providers, by autonomous system number. A
// beacon that reaches the edge from one of them is most likely a browser run
// by a machine in a data centre, so its row is marked, never dropped. The
// number is read off request.cf, compared with this list and discarded: it is
// never stored, logged or passed on, and only the mark is written.
//
// A closed list on purpose. Never add a network that carries relays for
// people (RELAY_ASNS below): iCloud Private Relay and similar services leave
// through them, and their rows are people.
export const HOSTING_ASNS: ReadonlySet<number> = new Set([
  16509, 14618, // Amazon Web Services
  15169, 396982, // Google, Google Cloud
  8075, // Microsoft
  45102, 37963, // Alibaba Cloud
  132203, 45090, // Tencent Cloud
  136907, // Huawei Cloud
  14061, // DigitalOcean
  16276, // OVH
  24940, // Hetzner
  63949, // Linode
  31898, // Oracle Cloud
  20473, // Vultr
  51167, // Contabo
  12876, // Scaleway
  60781, // Leaseweb
]);

// Cloudflare, Akamai (two), Fastly, Apple. Kept here so a test can hold the
// two lists apart.
export const RELAY_ASNS: readonly number[] = [13335, 36183, 20940, 54113, 714];

/** True when the request reached the edge from a listed hosting network. */
export function fromHostingNetwork(request: Request): boolean {
  const asn = (request as Request & { cf?: { asn?: unknown } }).cf?.asn;
  return typeof asn === 'number' && HOSTING_ASNS.has(asn);
}
