import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 应用启动日志
console.log("[应用启动] Branchlet 应用正在初始化...");
console.log("[启动时间]", new Date().toISOString());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
