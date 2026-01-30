export function getDeviceStatusInfo(status, lastSeen) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'pending') {
        return {
            label: 'Pending',
            className: 'bg-amber-900 text-amber-200 border-amber-800',
        };
    }
    if (normalized === 'active' || normalized === 'online' || normalized === 'healthy') {
        return {
            label: 'Healthy',
            className: 'bg-green-900 text-green-200 border-green-800',
        };
    }
    if (normalized === 'disabled') {
        return {
            label: 'Disabled',
            className: 'bg-gray-800 text-gray-300 border-gray-700',
        };
    }
    if (normalized === 'error' || normalized === 'offline') {
        return {
            label: 'Offline',
            className: 'bg-red-900 text-red-200 border-red-800',
        };
    }
    if (lastSeen && isRecent(lastSeen, 120000)) {
        return {
            label: 'Healthy',
            className: 'bg-green-900 text-green-200 border-green-800',
        };
    }
    return {
        label: 'Offline',
        className: 'bg-red-900 text-red-200 border-red-800',
    };
}

export function formatLastSeen(value) {
    if (!value) return 'Not seen yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) {
        return 'Not seen yet';
    }
    return date;
}

export function formatHost(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (!text) return '';
    const idx = text.indexOf('/');
    return idx >= 0 ? text.slice(0, idx) : text;
}

function isRecent(value, thresholdMs) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return (Date.now() - date.getTime()) < thresholdMs;
}
