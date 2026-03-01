import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, afterEach, expect } from 'vitest';
import { Switches } from '../Switches';

vi.mock('../../api', () => ({
    api: {
        getDevices: vi.fn(),
    },
}));

const { api } = await import('../../api');

function renderSwitches() {
    return render(
        <MemoryRouter>
            <Switches />
        </MemoryRouter>
    );
}

describe('Switches page', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading then renders devices', async () => {
        api.getDevices.mockResolvedValue({
            devices: [{ id: 1, hostname: 'sw1', mgmt_ip: '10.0.0.1', site: 'lab', last_seen: new Date().toISOString() }]
        });
        renderSwitches();

        expect(screen.getByText(/loading switches/i)).toBeInTheDocument();
        expect(await screen.findByText('sw1')).toBeInTheDocument();
    });

    it('shows empty state when no devices exist', async () => {
        api.getDevices.mockResolvedValue({ devices: [] });
        renderSwitches();

        expect(await screen.findByText(/no switches discovered yet/i)).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
        api.getDevices.mockRejectedValue(new Error('boom'));
        renderSwitches();

        expect(await screen.findByText(/unable to load switches/i)).toBeInTheDocument();
        await waitFor(() => expect(api.getDevices).toHaveBeenCalledTimes(1));
    });
});
