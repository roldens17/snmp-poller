import React from 'react';
import { Outlet } from 'react-router-dom';

const Stub = ({ label }) => <div>{label}</div>;

export const routes = [
  {
    path: '/',
    Component: () => <Outlet />,
    children: [
      { path: 'snmp/clients', Component: () => <Stub label="clients" /> },
      { path: 'snmp/switches', Component: () => <Stub label="switches" /> },
      { path: 'snmp/topology', Component: () => <Stub label="topology" /> },
      { path: 'snmp/alerts', Component: () => <Stub label="alerts" /> },
      { path: 'snmp/reports', Component: () => <Stub label="reports" /> },
      { path: 'snmp/settings', Component: () => <Stub label="settings" /> },
    ],
  },
];
