// Importer des librairies
const { app, ipcMain, Menu, Tray, shell, screen } = require("electron")
const { platform, hostname, networkInterfaces } = require("os")
const fetch = require("node-fetch")
const positioner = require("electron-traywindow-positioner")
const { join } = require("path")
const express = require("express")
const crypto = require("crypto")

// Fenêtre du navigateur
var BrowserWindow
if(process.platform == "win32") BrowserWindow = require("mica-electron").MicaBrowserWindow
else BrowserWindow = require("electron").BrowserWindow

// Variables
var additionalIps = []
var ownLocalIpCache

// Menu contextuel
const contextMenu = require("electron-context-menu")
contextMenu({
	showSearchWithGoogle: false,
	showLearnSpelling: false,
	showLookUpSelection: false,
	showSelectAll: false,

	shouldShowMenu: (event, parameters) => parameters.isEditable,

	append: () => [
		{
			label: "Envoyer avec effet",
			submenu: [
				{
					label: "Défilant",
					click: () => window.webContents.send("effect", "marquee")
				},
				{
					label: "Rotation",
					click: () => window.webContents.send("effect", "rotate")
				},
				{
					label: "Battements",
					click: () => window.webContents.send("effect", "pulse")
				},
				{
					label: "Vibrations",
					click: () => window.webContents.send("effect", "vibrate")
				},
				{ type: "separator" },
				{
					label: "Chute",
					click: () => window.webContents.send("effect", "rotate-down")
				},
				{
					label: "Secousse",
					click: () => window.webContents.send("effect", "wobble")
				},
				{
					label: "Confettis",
					click: () => window.webContents.send("effect", "tada")
				},
				{
					label: "Rebondissant",
					click: () => window.webContents.send("effect", "bounce")
				},
				{ type: "separator" },
				{
					label: "Cheum",
					click: () => window.webContents.send("effect", "ugly")
				},
				{
					label: "Belge",
					click: () => window.webContents.send("effect", "belgian")
				},
				{
					label: "Multicolore",
					click: () => window.webContents.send("effect", "rainbow")
				},
				{
					label: "Couleurs inversées",
					click: () => window.webContents.send("effect", "invert")
				},
				{ type: "separator" },
				{
					label: "Énorme",
					click: () => window.webContents.send("effect", "big")
				},
				{
					label: "Discret",
					click: () => window.webContents.send("effect", "discret")
				},
			]
		}
	]
})

// On définit quelques variables
var window
var showWindow
var connectedIPs = []

// Si l'appli est déjà ouverte en arrière plan, on la focus
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock){
	app.quit()
} else {
	// On focus la fenêtre si on reçoit une seconde instance
	app.on("second-instance", () => {
		if(window){
			console.log("Already running, focusing...")
			setTimeout(() => showWindow(), 400)
		}
	})
}

// Fonction pour arrêter l'application
function stopApp(){
	// Arrêter l'application normalement
	console.log("Stopping app...")
	app.quit()

	// Arrêter l'application de force
	setTimeout(() => {
		if(app){
			console.log("App didn't quit, force stopping...")
			process.exit(0)
		}
	}, 5000)
}

// Fonction pour crée une nouvelle fenêtre
async function main(){
	// Définir la taille de la fenêtre de notif en fonction de la taille de l'écran (le résultat est d'~ 16x16)
	var { width } = screen.getPrimaryDisplay().workAreaSize
	console.log("Screen size:", width)
	var notifWidth = Math.floor(width * 0.01)

	// Fenêtre secondaire pour afficher un indicateur quand on a une notif
	var notifWindow = new BrowserWindow({
		width: notifWidth,
		height: notifWidth,
		x: 4,
		y: 4,
		frame: false,
		hasShadow: false,
		opacity: 0.8,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		show: false,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		autoHideMenuBar: true,
		hiddenInMissionControl: true
	})
	notifWindow.setIgnoreMouseEvents(true)
	notifWindow.loadFile(join(__dirname, "src/notif.html"))

	// Icone tray pour macOS
	let trayIcon;
	(process.platform === "darwin") ? trayIcon = "src/icons/DarwinTemplate.png" : trayIcon = "src/icons/transparent.png"

	// On crée une Tray (icône dans la barre des tâches)
	const tray = new Tray(join(__dirname, trayIcon))
	const trayContextMenu = Menu.buildFromTemplate([
		{ label: "Quitter", click: () => stopApp() },
	])
	if(process.platform == "linux") tray.setContextMenu(trayContextMenu)

	// Définir la fonction pour afficher la fenêtre
	showWindow = () => {
		console.log("Showing window...")

		// On positionne
		var position = tray.getBounds()
		position.y -= 12 // on baisse vite fait la position
		positioner.position(window, position)

		// On affiche
		window.show()
	}

	// Afficher la fenêtre quand on clique sur l'icône
	tray.on("click", () => {
		console.log("Tray clicked, showing window...")
		showWindow()
	})

	tray.on("right-click", () => {
		tray.popUpContextMenu(trayContextMenu)
	})

	// On crée la fenêtre
	window = new BrowserWindow({
		width: 400,
		height: 478,
		icon: join(__dirname, "src/icons/transparent.png"),
		title: "LocalChat",
		webPreferences: {
			preload: join(__dirname, "src/js/preload.js"),
			spellcheck: true
		},
		resizable: false,
		skipTaskbar: true,
		movable: false,
		minimizable: false,
		maximizable: false,
		transparent: true,
		fullscreenable: false,
		autoHideMenuBar: true,
		frame: false,
		hiddenInMissionControl: true,
		titleBarStyle: platform() !== "darwin" && "hidden",
		show: false,
	})
	window.loadFile(join(__dirname, "src/chat.html"))

	// Ouvrir les liens externes dans le navigateur
	window.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: "deny" }
	})

	// Fermer l'app quand l'user ferme la fenêtre principale
	window.on("close", () => stopApp())

	// On définit des variables
	var ready = false
	var isShowed = false
	var lastIpCheck = 0

	// Quand on perd le focus, on masque la fenêtre
	window.on("blur", () => {
		if(ready){
			console.log("Window lost focus, hiding...")
			window.hide()
			isShowed = false
		}
	})
	setTimeout(() => {
		ready = true
	}, 700)

	// Quand l'app est affichée
	window.on("show", () => {
		console.log("Window showed.")
		isShowed = true
	})

	// Ouvrir un serveur pour les autres appareils
	const appExpress = express()
	appExpress.use(require("body-parser").json())
	const server = require("http").createServer(appExpress)
	try {
		server.listen(9123, () => {
			console.log("Server listening on port 9123.")
		})
	} catch(err){
		console.error(err)
		stopApp()
	}

	// Route pour que les autres appareils puissent ping
	appExpress.get("/ping", (req, res) => {
		res.status(200).send("OK")
	})

	// Route pour que les autres appareils puissent envoyer un message à cet appareil
	var notifWindowShowTimeout
	var isShowingNotif = false
	appExpress.post("/message", async (req, res) => {
		// On récupère les infos
		var message = req.body?.message
		var username = req.body?.username
		var ids = req.body?.ids || {}
		var effect = req.body?.effect || null

		// Vérifier les infos
		if(!username || !username.trim().length) return res.status(400).send("No username provided.")
		if(!message) return res.status(400).send("No message provided.")
		if(typeof message != "string") return res.status(400).send("Message must be a string.")
		if(!ids?.key || !ids?.iv) return res.status(400).send("No ids provided (or 1/2 is missing).")

		// Obtenir l'IP de celui qui a envoyé le message
		var ipAddr = req.ip || "IP inconnue"
		ipAddr = ipAddr.replace(/[^0-9.]/g, "")

		// Tenter de déchiffrer le message
		var decryptedMessage = decryptText(message, ids.key, ids.iv)

		// On envoie le message à la fenêtre
		window.webContents.send("message", { message: decryptedMessage || "Impossible de déchiffrer le message, cela vient sûrement de la personne ayant envoyé ce message.", username, effect, ipAddr })
		res.status(200).send("OK")

		if(!isShowed){
			// Masquer le précédent indicateur de notif
			if(notifWindowShowTimeout) clearTimeout(notifWindowShowTimeout)
			if(isShowingNotif){
				notifWindow.hide()
				await new Promise(resolve => setTimeout(resolve, 100))
			}

			// Afficher un indicateur de notif
			notifWindow.show()
			isShowingNotif = true
			notifWindowShowTimeout = setTimeout(() => notifWindow.hide(), 3000)
		}
	})

	// IPC
	ipcMain.on("hide", () => { // masquer la fenêtre
		isShowed = false
		window.hide()
	})
	ipcMain.on("addIp", (event, ip) => { // ajouter une IP
		ip = ip.replace(/[^0-9.]/g, "")
		console.log("Ajout d'une ip:", ip)
		if(!additionalIps.includes(ip) && ip != ownLocalIpCache) additionalIps.push(ip)
	})
	ipcMain.on("getInfos", async () => { // envoyer les infos sur demande
		await getLocalIP()
		window.webContents.send("ownIp", ownLocalIpCache)

		// Scanner les IPs si ça fait plus de 5 secondes
		if(Date.now() - lastIpCheck > 5000){
			lastIpCheck = Date.now()
			connectedIPs = await getNetworkIPs()
		}
		window.webContents.send("connected", connectedIPs)
	})

	// On recherche continuellement des appareils connectés
	setInterval(async () => {
		if(Date.now() - lastIpCheck < 3000) return
		lastIpCheck = Date.now()
		connectedIPs = await getNetworkIPs()
		window.webContents.send("connected", connectedIPs)
	}, 20000)
}

// Quand Electron est prêt
app.whenReady().then(async () => {
	main() // on démarre

	// Masquer l'app du dock
	if(platform() == "darwin") app.dock.hide()

	app.on("activate", () => { // nécessaire pour macOS
		if(BrowserWindow.getAllWindows().length === 0) main()
	})
})

// Fonction pour faire une requête fetch, avec un timeout
async function fetchWithTimeout(url, timeout, options = {}){
	const controller = new AbortController()
	const id = setTimeout(() => controller.abort(), timeout)
	const response = await fetch(url, {
		...options, signal: controller.signal
	})
	clearTimeout(id)
	return response
}

// Fonction pour obtenir son IP local
async function getLocalIP(){
	var ip = networkInterfaces()["Wi-Fi"]?.filter(i => i?.family == "IPv4")[0] || Object.values(networkInterfaces()).flat().filter(({ family, internal }) => family === "IPv4" && !internal).map(({ address }) => address)[0] || await require("dns").promises.lookup(hostname())
	ownLocalIpCache = ip.address || ip || null
	return ownLocalIpCache
}

// Fonction pour obtenir l'IP de tout les appareils connectés au réseau
async function getNetworkIPs(){
	// Obtenir l'IP local
	var localIp = await getLocalIP()
	var localIPs = [localIp, ...additionalIps]
	localIPs = localIPs.filter(i => i && !i.startsWith("127."))

	// Faire une liste avec toutes les potentielles IP
	console.log("Will check sub-IPs:", localIPs)
	var potentialIPs = []
	for(var ip of localIPs){
		for(var i = 0; i < 256; i++) potentialIPs.push(ip.replace(/\d+$/, i))
	}

	// Eviter d'avoir les trucs en double
	potentialIPs = [...new Set(potentialIPs)]

	// Tester si les IPs sont valides
	var validIPs = []
	var waitGetIps = new Promise((resolve, reject) => {
		var checkedIPs = 0
		potentialIPs.forEach(async (ip, i) => {
			try {
				var res = await fetchWithTimeout(`http://${ip}:9123/ping`, 5000).catch((err) => { return { ok: false } })
				if(res.ok) validIPs.push(ip)
				checkedIPs++
			} catch(err){}
			if(checkedIPs == potentialIPs.length) resolve()
		})
	})
	await waitGetIps

	// Enlever sa propre IP locale
	validIPs = validIPs.filter(i => i != localIp)

	// Enlever les IPs en double
	validIPs = [...new Set(validIPs)]

	// Retourner les IP valides
	console.log(`${validIPs.length} valid IPs found:`, validIPs)
	return validIPs
}

// Fonction pour déchiffrer du texte base64
function decryptText(encryptedText, key, iv) {
	// Décoder les clés
	key = Buffer.from(key, "base64")
	iv = Buffer.from(iv, "base64")
	console.log("Decoding with key:", key, "and iv:", iv)
	// Déchiffrer le texte
	try {
		const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
		let decrypted = decipher.update(Buffer.from(encryptedText, "base64"))
		decrypted = Buffer.concat([decrypted, decipher.final()])
		return decrypted.toString()
	} catch(err) {
		console.error(err)
		return `Impossible de déchiffrer le message, cela vient sûrement de la personne ayant envoyé ce message.\nErreur: ${err.message || err}`
	}
}