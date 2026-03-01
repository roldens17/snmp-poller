
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const savedTheme = localStorage.getItem("theme");
const theme = savedTheme === "light" ? "light" : "dark";
document.documentElement.classList.toggle("dark", theme === "dark");

createRoot(document.getElementById("root")!).render(<App />);
  
