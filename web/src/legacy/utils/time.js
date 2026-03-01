export function parseAPITimestamp(value) {
    if (!value) return null;
    // Safari rejects >3 fractional digits; normalize to milliseconds.
    const normalized = value.replace(/(\.\d{3})\d+Z$/, '$1Z');
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}
