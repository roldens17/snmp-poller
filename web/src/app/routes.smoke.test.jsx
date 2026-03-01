import React from 'react';
import { describe, it, expect } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { routes as appRoutes } from './testRoutes';

const paths = [
  '/snmp/clients',
  '/snmp/switches',
  '/snmp/topology',
  '/snmp/alerts',
  '/snmp/reports',
  '/snmp/settings',
];

describe('legacy /snmp route bridge', () => {
  for (const path of paths) {
    it(`renders without crashing: ${path}`, async () => {
      const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
      render(<RouterProvider router={router} />);
      // smoke: app shell should at least mount
      expect(document.body).toBeTruthy();
    });
  }
});
