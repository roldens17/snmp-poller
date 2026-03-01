import { createBrowserRouter } from "react-router-dom";
import { Root } from "./components/Root";

const Dashboard = async () => ({ Component: (await import("./components/Dashboard")).Dashboard });
const Devices = async () => ({ Component: (await import("./components/Devices")).Devices });
const Incidents = async () => ({ Component: (await import("./components/Incidents")).Incidents });
const Webhooks = async () => ({ Component: (await import("./components/Webhooks")).Webhooks });
const Reports = async () => ({ Component: (await import("./components/Reports")).Reports });
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
const AcceptInvite = async () => ({ Component: (await import("../legacy/pages/AcceptInvite")).AcceptInvite });

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, lazy: Dashboard },
      { path: "devices", lazy: Devices },
      { path: "incidents", lazy: Incidents },
      { path: "webhooks", lazy: Webhooks },
      { path: "reports", lazy: Reports },
      { path: "settings", lazy: Settings },
      { path: "snmp/clients", lazy: LegacyClients },
      { path: "snmp/switches", lazy: LegacySwitches },
      { path: "snmp/topology", lazy: LegacyTopology },
      { path: "snmp/alerts", lazy: LegacyAlerts },
      { path: "snmp/reports", lazy: LegacyReports },
      { path: "snmp/settings", lazy: LegacySettings },
      { path: "snmp/devices/new", lazy: LegacyDeviceNew },
      { path: "snmp/devices/:id", lazy: LegacyDeviceDetail },
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
