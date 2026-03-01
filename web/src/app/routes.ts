import { createBrowserRouter, redirect } from "react-router-dom";

import { Root } from "./components/Root";

const Dashboard = async () => ({ Component: (await import("./components/Dashboard")).Dashboard });
const Devices = async () => ({ Component: (await import("./components/Devices")).Devices });
const Incidents = async () => ({ Component: (await import("./components/Incidents")).Incidents });
const Webhooks = async () => ({ Component: (await import("./components/Webhooks")).Webhooks });
const Reports = async () => ({ Component: (await import("./components/Reports")).Reports });
const ReportPrint = async () => ({ Component: (await import("./components/ReportPrint")).ReportPrint });
const Topology = async () => ({ Component: (await import("./components/Topology")).Topology });
const DeviceDetail = async () => ({ Component: (await import("./components/DeviceDetail")).DeviceDetail });
const Settings = async () => ({ Component: (await import("./components/Settings")).Settings });
const Login = async () => ({ Component: (await import("./components/Login")).Login });
const Signup = async () => ({ Component: (await import("./components/Signup")).Signup });

const LegacyClients = async () => ({ Component: (await import("../legacy/pages/Clients")).Clients });
const LegacySwitches = async () => ({ Component: (await import("../legacy/pages/Switches")).Switches });
const LegacyTopology = async () => ({ Component: (await import("../legacy/pages/Topology")).Topology });
const LegacyAlerts = async () => ({ Component: (await import("../legacy/pages/Alerts")).Alerts });
const LegacyReports = async () => ({ Component: (await import("../legacy/pages/Reports")).Reports });
const LegacySettings = async () => ({ Component: (await import("../legacy/pages/Settings")).Settings });
const LegacyDeviceDetail = async () => ({ Component: (await import("../legacy/pages/DeviceDetail")).DeviceDetail });
const LegacyDeviceNew = async () => ({ Component: (await import("../legacy/pages/DeviceNew")).DeviceNew });
const AcceptInvite = async () => ({ Component: (await import("./components/AcceptInvite")).AcceptInvite });

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, lazy: Dashboard },
      { path: "devices", lazy: Devices },
      { path: "devices/:id", lazy: DeviceDetail },
      { path: "incidents", lazy: Incidents },
      { path: "webhooks", lazy: Webhooks },
      { path: "reports", lazy: Reports },
      { path: "reports/print", lazy: ReportPrint },
      { path: "topology", lazy: Topology },
      { path: "settings", lazy: Settings },
      { path: "snmp/clients", loader: () => redirect("/devices") },
      { path: "snmp/switches", loader: () => redirect("/devices") },
      { path: "snmp/topology", loader: () => redirect("/topology") },
      { path: "snmp/alerts", loader: () => redirect("/incidents") },
      { path: "snmp/reports", loader: () => redirect("/reports") },
      { path: "snmp/settings", loader: () => redirect("/settings") },
      { path: "snmp/devices/new", loader: () => redirect("/devices") },
      { path: "snmp/devices/:id", loader: () => redirect("/devices") },
    ],
  },
  {
    path: "/login",
    lazy: Login,
  },
  {
    path: "/signup",
    lazy: Signup,
  },
  {
    path: "/accept-invite",
    lazy: AcceptInvite,
  },
]);
