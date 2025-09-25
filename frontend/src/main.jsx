import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
    console.warn("⚠️ Warning: No #root element found in the DOM.");
} else {
    const appElement = import.meta.env.MODE === "development" ? (
        <React.StrictMode>
            {console.log("🚀 Running in Strict Mode (Development)")}
            <App />
        </React.StrictMode>
    ) : (
        <App />
    );

    ReactDOM.createRoot(rootElement).render(appElement);
}

