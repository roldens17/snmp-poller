import { createBrowserRouter } from "react-router-dom";
import { Root } from "./components/Root";
import { Dashboard } from "./components/Dashboard";
import { Devices } from "./components/Devices";
import { Incidents } from "./components/Incidents";
import { Webhooks } from "./components/Webhooks";
import { Reports } from "./components/Reports";
import { Settings } from "./components/Settings";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { Clients as LegacyClients } from "../legacy/pages/Clients";
import { Switches as LegacySwitches } from "../legacy/pages/Switches";
import { Topology as LegacyTopology } from "../legacy/pages/Topology";
import { Alerts as LegacyAlerts } from "../legacy/pages/Alerts";
import { Reports as LegacyReports } from "../legacy/pages/Reports";
import { Settings as LegacySettings } from "../legacy/pages/Settings";
import { DeviceDetail as LegacyDeviceDetail } from "../legacy/pages/DeviceDetail";
import { DeviceNew as LegacyDeviceNew } from "../legacy/pages/DeviceNew";
import { AcceptInvite } from "../legacy/pages/AcceptInvite";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "devices", Component: Devices },
      { path: "incidents", Component: Incidents },
      { path: "webhooks", Component: Webhooks },
      { path: "reports", Component: Reports },
      { path: "settings", Component: Settings },
      { path: "snmp/clients", Component: LegacyClients },
      { path: "snmp/switches", Component: LegacySwitches },
      { path: "snmp/topology", Component: LegacyTopology },
      { path: "snmp/alerts", Component: LegacyAlerts },
      { path: "snmp/reports", Component: LegacyReports },
      { path: "snmp/settings", Component: LegacySettings },
      { path: "snmp/devices/new", Component: LegacyDeviceNew },
      { path: "snmp/devices/:id", Component: LegacyDeviceDetail },
    ],
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/accept-invite",
    Component: AcceptInvite,
  },
]);
