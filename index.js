console.log("Hello world!")
var perfNow = performance.now()

// Importer des librairies
const { app, ipcMain, Menu, Tray, shell, screen } = require("electron")
const { platform, hostname, networkInterfaces } = require("os")
const fetch = require("node-fetch")
const positioner = require("electron-traywindow-positioner")
const { join } = require("path")
const express = require("express")
const crypto = require("crypto")
const findArpDevices = require("local-devices")

// Fenêtre du navigateur
var BrowserWindow
if(process.platform == "win32") BrowserWindow = require("mica-electron").MicaBrowserWindow
else BrowserWindow = require("electron").BrowserWindow

// Variables
var additionalIps = []
var ownLocalIpCache
var ownLocalIpCacheExpire = 0
var arpDevicesCache
var arpDevicesCacheExpire = 0

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
			label: "Changer de nom",
			click: () => window.webContents.send("rename")
		},
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
				{
					label: "Inversé",
					click: () => window.webContents.send("effect", "flip")
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
	console.log(`Main function called after ${Math.round(performance.now() - perfNow)}ms`)

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
		hiddenInMissionControl: true,
	})
	notifWindow.setIgnoreMouseEvents(true)
	notifWindow.setFocusable(false)
	notifWindow.loadFile(join(__dirname, "src/notif.html"))

	// Icone tray pour macOS
	let trayIcon;
	(process.platform === "darwin") ? trayIcon = "src/icons/DarwinTemplate.png" : trayIcon = "src/icons/transparent.png"

	// On crée une Tray (icône dans la barre des tâches)
	const tray = new Tray(join(__dirname, trayIcon))
	var msgsUnreadCount = 0
	var trayTemplate = [
		{ label: "0 non lu", id: "unread-count", enabled: false },
		{ type: "separator" },
		{ label: "Afficher", click: () => showWindow() },
		{ label: "Quitter", click: () => stopApp() },
	]
	var trayContextMenu = Menu.buildFromTemplate(trayTemplate)
	if(process.platform == "linux") tray.setContextMenu(trayContextMenu)

	updateTray = () => {
		console.log("Updating tray with unread count:", msgsUnreadCount)
		trayTemplate.find(i => i.id == "unread-count").label = `${msgsUnreadCount} non lu${msgsUnreadCount > 1 ? "s" : ""}`
		trayContextMenu = Menu.buildFromTemplate(trayTemplate)
		if(process.platform == "linux") tray.setContextMenu(trayContextMenu)
	}

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
		msgsUnreadCount = 0
		updateTray()

		console.log("Tray clicked, showing window...")
		showWindow()
	})

	tray.on("right-click", () => {
		updateTray()

		console.log("Right clicked on tray, showing context menu...")
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
			if(process.platform == "darwin") app.hide()
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
		console.log("Someone pinged us.")
		res.status(200).send("OK")
	})

	// Route pour que les autres appareils puissent envoyer un message à cet appareil
	var notifWindowShowTimeout
	var isShowingNotif = false
	appExpress.post("/message", async (req, res) => {
		console.log("[POST /message] Received a message.")

		// On récupère les infos
		var message = req.body?.message
		var username = req.body?.username
		var ids = req.body?.ids || {}
		var effect = req.body?.effect || null

		// Vérifier les infos
		console.log(`[POST /message] Infos: ${JSON.stringify({ message, username, ids, effect })}`)
		if(!username || !username.trim().length) return res.status(400).send("No username provided.")
		if(!message) return res.status(400).send("No message provided.")
		if(typeof message != "string") return res.status(400).send("Message must be a string.")
		if(!ids?.key || !ids?.iv) return res.status(400).send("No ids provided (or 1/2 is missing).")

		// Obtenir l'IP de celui qui a envoyé le message
		var ipAddr = req.ip || "IP inconnue"
		ipAddr = ipAddr.replace(/[^0-9.]/g, "")
		if(ipAddr && ipAddr != "IP inconnue") additionalIps.push(ipAddr)
		if(ipAddr.startsWith("::ffff:")) ipAddr = ipAddr.replace("::ffff:", "") // plus propre dans l'interface
		console.log(`[POST /message] Incoming message is from ${username} with IP address ${ipAddr}`)

		// Tenter de déchiffrer le message
		console.log("[POST /message] Decrypting message...")
		var decryptedMessage = decryptText(message, ids.key, ids.iv)
		console.log("[POST /message] Decrypted message:", decryptedMessage)

		// Vérifier si le message contient quelque chose
		if(isEmpty(decryptedMessage)){
			console.error("[POST /message] Message (after decryption) is empty.")
			return res.status(400).send("Message (after decryption) is empty.")
		}

		// On envoie le message à la fenêtre
		window.webContents.send("message", { message: decryptedMessage || "Impossible de déchiffrer le message, cela vient sûrement de la personne ayant envoyé ce message.", username, effect, ipAddr })
		res.status(200).send("OK")

		if(!isShowed){
			console.log("[POST /message] Main chat window isn't showed, we will display an indicator.")

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

			// Modifier le nombre de messages non lus
			msgsUnreadCount++
			updateTray()
		}
	})

	// IPC
	ipcMain.on("hide", () => { // masquer la fenêtre
		isShowed = false
		window.hide()
		if(process.platform == "darwin") app.hide()
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

// Fonction pour vérifier si un string est vide
function isEmpty(str){
	str = str.trim().replace(/\s/g, "")
	return str.length == 0
}

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
	if(ownLocalIpCache && ownLocalIpCacheExpire > Date.now()) return ownLocalIpCache

	var ip = networkInterfaces()["Wi-Fi"]?.filter(i => i?.family == "IPv4")[0] || Object.values(networkInterfaces()).flat().filter(({ family, internal }) => family === "IPv4" && !internal).map(({ address }) => address)[0] || await require("dns").promises.lookup(hostname())

	ownLocalIpCache = ip.address || ip || null
	ownLocalIpCacheExpire = Date.now() + (1000 * 60 * 5)
}

// Fonction pour obtenir l'IP de tout les appareils connectés au réseau
async function getNetworkIPs(){
	// Obtenir les appareils sur le réseau avec ARP
	var arpDevices = []
	if(arpDevicesCache && arpDevicesCacheExpire > Date.now()){
		console.log("[getNetworkIps] ARP was still in cache.")
		arpDevices = arpDevicesCache
	} else try {
		console.log("[getNetworkIps] Getting devices through ARP...")
		var _arpDevices = await findArpDevices({ skipNameResolution: true }).catch(() => [])
		if(_arpDevices?.length){
			arpDevices = _arpDevices.map(i => i.ip)
			arpDevicesCache = arpDevices
			arpDevicesCacheExpire = Date.now() + (1000 * 60 * 3) // 3 minutes
		}
	} catch(err){
		console.warn("[getNetworkIps] ARP returned an error:")
		console.warn(err)
	}
	console.log(`[getNetworkIps] ${arpDevices.length} devices found through ARP`)

	// Obtenir l'IP local
	await getLocalIP()
	var localIPs = [ownLocalIpCache, ...arpDevices]
	localIPs = localIPs.filter(i => i && !i.startsWith("127."))

	// Faire une liste avec toutes les potentielles IP
	var potentialIPs = []
	for(var ip of localIPs){
		for(var i = 0; i < 256; i++) potentialIPs.push(ip.replace(/\d+$/, i))
	}
	additionalIps.forEach(ip => { potentialIPs.push(ip) })

	// Eviter d'avoir les trucs en double
	potentialIPs = [...new Set(potentialIPs)]
	potentialIPs = potentialIPs.filter(i => i != ownLocalIpCache)

	// Tester si les IPs sont valides
	var validIPs = []
	var waitGetIps = new Promise((resolve, reject) => {
		var checkedIPs = 0
		console.log(`[getNetworkIps] Checking ${potentialIPs.length} potential IPs...`)
		potentialIPs.forEach(async (ip, i) => {
			try {
				console.log(`[getNetworkIps] Checking IP ${i + 1}/${potentialIPs.length}:`, ip)
				var res = await fetchWithTimeout(`http://${ip}:9123/ping`, 5000).catch((err) => { return { ok: false } })
				if(res.ok) validIPs.push(ip)
				checkedIPs++
			} catch(err){}
			if(checkedIPs == potentialIPs.length) resolve()
		})
	})
	await waitGetIps
	console.log(`[getNetworkIps] Potentials IPs check got ${validIPs.length} valid IPs. We will filter those.`)

	// Filtrer les IPs en trop
	validIPs = validIPs.filter(i => i != ownLocalIpCache) // Sa propre IP locale
	validIPs = [...new Set(validIPs)] // IPs en double

	// Retourner les IP valides
	console.log(`[getNetworkIps] ${validIPs.length} valid IPs found:`, validIPs)
	return validIPs
}

// Fonction pour déchiffrer du texte base64
function decryptText(encryptedText, key, iv) {
	// Décoder les clés
	key = Buffer.from(key, "base64")
	iv = Buffer.from(iv, "base64")
	console.log("[decryptText] Decoding message with iv:", iv)
	console.log("[decryptText] Original key is:", key)

	// Ajouter des détails dans la clé, qui dcp ne sont pas dans la requête
	try {
		key.set(new TextEncoder().encode(new Date().getFullYear().toString()), 28)
		key.set([72, 101, 99, 14, 45, 98, 76, 111, 114, 54, 1, 9, 50, 8], 0)
		console.log("[decryptText] Key got updated to:", key)
	} catch(err){
		console.error(err)
	}

	// Déchiffrer le texte
	try {
		const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
		let decrypted = decipher.update(Buffer.from(encryptedText, "base64"))
		decrypted = Buffer.concat([decrypted, decipher.final()])
		return decrypted.toString()
	} catch(err) {
		console.error("[decryptText] Error while decrypting message:", err)
		console.error(err)
		return `Impossible de déchiffrer le message, cela vient sûrement de la personne ayant envoyé ce message.\nErreur: ${err.message || err}`
	}
}