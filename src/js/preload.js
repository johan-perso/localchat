const { ipcRenderer } = require("electron")

window.addEventListener("focus", () => {
	window.postMessage({ id: "focus" })
})

ipcRenderer.on("effect", (event, data) => { window.postMessage({ id: "effect", data }) })
ipcRenderer.on("message", (event, data) => { window.postMessage({ id: "message", data }) })
ipcRenderer.on("connected", (event, data) => { window.postMessage({ id: "connected", data }) })
ipcRenderer.on("ownIp", (event, data) => { window.postMessage({ id: "ownIp", data }) })
ipcRenderer.on("rename", (event) => { window.postMessage({ id: "rename" }) })

// envoyer du rendu (la page) au processus principale
window.addEventListener("message", (event) => {
	if(event.data.id == "addIp") ipcRenderer.send("addIp", event.data.data)
	else if(event.data.id == "hide") ipcRenderer.send("hide")
	else if(event.data.id == "getInfos") ipcRenderer.send("getInfos")
})