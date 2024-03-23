const { ipcRenderer } = require("electron")

window.addEventListener("focus", () => {
	window.postMessage({ id: "focus" })
})

ipcRenderer.on("effect", (event, data) => { window.postMessage({ id: "effect", data }) })
ipcRenderer.on("message", (event, data) => { window.postMessage({ id: "message", data }) })
ipcRenderer.on("connected", (event, data) => { window.postMessage({ id: "connected", data }) })