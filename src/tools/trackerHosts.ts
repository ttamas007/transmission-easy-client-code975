export default function trackerHosts(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const hosts = new Set<string>();
  const trackers: unknown[] = value;
  for (const tracker of trackers) {
    if (
      typeof tracker !== 'object' ||
      tracker === null ||
      !('announce' in tracker) ||
      typeof tracker.announce !== 'string'
    )
      return null;
    try {
      const url = new URL(tracker.announce);
      if (!['http:', 'https:', 'udp:'].includes(url.protocol) || !url.hostname) return null;
      hosts.add(url.hostname.toLowerCase().replace(/\.$/, ''));
    } catch {
      return null;
    }
  }
  return Array.from(hosts);
}
