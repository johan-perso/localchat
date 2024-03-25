var connectedIPs = []
var username
var jsConfetti
var ownIp

// Recevoir des messages du preload.js
window.addEventListener("message", (event) => {
	console.log(event.data)
	// Ajouter le focus aux éléments qui en ont besoin
	if(event.data.id == "focus") document.querySelector("[autofocus]")?.focus({ preventScroll: true })

	// Changer la liste des appareils connectés
	else if(event.data.id == "connected"){
		connectedIPs = event.data.data

		if(connectedIPs.length) document.getElementById("noRecipient").classList.add("hidden")
		else document.getElementById("noRecipient").classList.remove("hidden")
	}

	// Enregistrer sa propre IP
	else if(event.data.id == "ownIp") ownIp = event.data.data

	// Envoyer un message avec effet via le menu contextuel
	else if(event.data.id == "effect") sendMessage(event.data.data)

	// Afficher un message reçu
	else if(event.data.id == "message"){
		document.getElementById("messages")?.insertAdjacentHTML("beforeend", generateMessageContent({ ...event.data.data, self: false }))
		document.getElementById("messages")?.scrollTo(0, document.getElementById("messages")?.scrollHeight)
	}
})

// Raccourcis clavier
document.addEventListener("keydown", async (event) => {
	// Empêcher les raccourcis pour fermer la page
	if((event.ctrlKey || event.metaKey) && event.key == "w") event.preventDefault()
	else if((event.ctrlKey || event.metaKey) && event.key == "q") event.preventDefault()

	// Si on fait Enter sur le champ de pseudo, on rejoint le chat
	else if(event.key == "Enter" && document.activeElement?.id == "askusername") joinChat()

	// Si on appuie sur une certaine touche pendant qu'on est dans la zone de message
	else if(!event.shiftKey && event.key == "Enter" && document.activeElement?.id == "message"){ // Enter = envoyer le message au lieu de sauter une ligne
		event.preventDefault()
		sendMessage()
	}
	else if(document.activeElement?.id == "message" && event.shiftKey && event.key == "Enter"){ // Shift+Enter = sauter une ligne
		event.preventDefault()
		var cursorPosition = document.getElementById("message").selectionStart
		var textBefore = document.getElementById("message").value.substring(0, cursorPosition)
		var textAfter = document.getElementById("message").value.substring(cursorPosition)
		document.getElementById("message").value = `${textBefore}\n${textAfter}`
	}

	// Masquer la fenêtre avec échap
	else if(event.key == "Escape") window.postMessage({ id: "hide" })

	// Si on veut écrire quelque chose dans la zone de texte sans l'avoir focus
	else if(!event.ctrlKey && !event.metaKey && !event.altKey && document.activeElement?.tagName != "TEXTAREA" && document.activeElement?.tagName != "INPUT"){
		document.getElementById("message")?.focus()
	}
	else if((event.ctrlKey || event.metaKey) && event.key == "v" && document.activeElement?.tagName != "TEXTAREA" && document.activeElement?.tagName != "INPUT"){
		event.preventDefault()
		document.getElementById("message")?.focus()
		document.execCommand("paste")
	}
})

// Quand la page est chargé
window.onload = async function () {
	window.postMessage({ id: "getInfos" })
}

// Fonction pour rejoindre le chat
async function joinChat(){
	// Liste de noms d'utilisateurs aléatoires
	var randomUsernames = ["ShiftedRy", "Kittenboy", "TruLuv89", "FlavaLamp", "Powerbutton", "Helix28", "TheAccountant", "heavenshawk", "RazerBlayd", "Sincity45", "Lostblood", "Fishguises", "GreenWoods", "Effervescent", "ActiveMitzi", "Born2Tuch", "DollZest", "GoodTeenz", "LedgerCotton", "Dstonk", "StyleBoz", "AssassinRage", "PeppyDose", "ShadowArtisan", "Autistic", "FluffyPhantom", "DigitalSentinel", "InfamousCoin", "Player", "QuietInstigator", "RebelHorn", "FiendishSpeedster", "MustachedMarksman", "XxSpeedrunner", "MischievousCrash", "MintySweet", "EnchantedIron", "JaggedProwess", "IntimidateHare", "RamboGirl", "ImpulseUnicorn", "MajesticKiller", "JuicyTracker", "AnimeGirl", "AngrySlayer", "EpicVisage", "GhostCharm", "TerraRider", "NimbleBat", "StrangeKitten", "FuriousBlast", "RoughWarrior", "InsaneNight", "SourThuliumSpeed", "ErbiumRecluse420", "69ToadIodine", "AutisticSnazzyFlower", "JuneAutistic", "Altf4"]

	// Récupérer le nom d'utilisateur
	username = document.getElementById("askusername")?.value
	if(!username?.length || !username.trim().length) username = randomUsernames[Math.floor(Math.random() * randomUsernames.length)]

	// Supprimer le modal et rendre le conteneur principal visible
	document.getElementById("askusername-modal")?.remove()
	document.getElementById("mainContainer")?.classList.remove("opacity-30", "pointer-events-none")
}

// Fonction pour envoyer un message
async function sendMessage(effect){
	// Si le bouton est déjà désactivé, on annule l'envoi
	if(document.getElementById("sendButton").getAttribute("disabled")) return

	// Vérifier qu'on a un pseudo
	if(!username?.length || !username.trim().length) return

	// Récupérer le message à envoyer
	var message = document.getElementById("message")?.value
	if(!message?.length) return console.log("No message provided.")

	// Désactiver le bouton envoyer et vider le champ de texte
	document.getElementById("sendButton")?.setAttribute("disabled", "disabled")
	document.getElementById("message").value = ""
	document.getElementById("message").focus()

	// Si c'est pour ajouter une IP
	if(message.startsWith("/addip ")){
		var ip = message.split(" ")[1]
		if(!ip?.length){
			document.getElementById("sendButton").removeAttribute("disabled")
			return alert("Vous devez spécifier une adresse IP.")
		}
		window.postMessage({ id: "addIp", data: ip })
		window.postMessage({ id: "getInfos" })
		alert("Adresse IP ajoutée avec succès.")
		return document.getElementById("sendButton").removeAttribute("disabled")
	}

	// Chiffrer le message (256 bits)
	var key = window.crypto.getRandomValues(new Uint8Array(32))
	var iv = window.crypto.getRandomValues(new Uint8Array(16))

	// Envoyer le message à tout le monde
	var actuallySendToAnyone = false
	var sendMessagePromise = new Promise((resolve, reject) => {
		if(connectedIPs.length) connectedIPs.forEach(async (ip, i) => {
			try {
				await fetch(`http://${ip}:9123/message`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: await encryptText(message, key, iv),
						username, effect,
						ids: {
							key: btoa(String.fromCharCode(...key)),
							iv: btoa(String.fromCharCode(...iv))
						}
					})
				})
			} catch(err){}
			if(i == connectedIPs.length - 1){
				actuallySendToAnyone = true
				resolve()
			}
		})
		else resolve()
	})
	await sendMessagePromise

	// Réactiver le bouton pour envoyer
	document.getElementById("sendButton").removeAttribute("disabled")

	// Ajouter le message à la fenêtre
	document.getElementById("messages")?.insertAdjacentHTML("beforeend", generateMessageContent({ username, message, effect, self: true, actuallySendToAnyone, ipAddr: ownIp }))
	document.getElementById("messages")?.scrollTo(0, document.getElementById("messages")?.scrollHeight)
}

// Fonction pour générer le contenu d'un message
function generateMessageContent({ username, message, effect, self, actuallySendToAnyone, ipAddr }){
	// Si on veut afficher un effet de confettis
	if(effect == "tada"){
		if(!jsConfetti) jsConfetti = new JSConfetti()
		jsConfetti.addConfetti({
			confettiRadius: 5,
			confettiNumber: 300
		})
	}

	// Retourner le message
	return `<div class="flex items-start gap-2.5 mr-2 ${self ? "justify-end" : ""}">
	<div class="flex flex-col gap-1">
		<div class="flex items-center space-x-2 ${self ? "justify-end" : ""}">
			<span class="text-sm font-semibold textColor break-all select-text">${escapeHtml(username)}${ipAddr ? ` (${escapeHtml(ipAddr || "IP inconnue")})` : ""}</span>
			<span class="text-sm font-normal text-gray-500 dark:text-gray-400">${actuallySendToAnyone || !self ? getTime() : "Non delivré"}</span>
		</div>
		<div
			class="flex flex-col leading-1.5 px-4 py-3 border-[#e8e8e8] dark:border-[#464646] border-[0.5px] ${effect == "rainbow" ? "rainbowBg" : ""} ${effect != "belgian" && effect != "rainbow" ? "bg-fcfcfc dark-bg-363636" : ""} ${self ? "rounded-l-xl rounded-br-xl" : "rounded-e-xl rounded-es-xl"}"
			style="${effect == "belgian" ? "background: linear-gradient(to right, #000000 33.333%, #FDDA24 33.33% 66.666%, #EF3340 66.666%);" : ""}"
		>
			${effect == "marquee" ? "<marquee direction=\"up\">" : ""}
				<p class="${effect == "discret" ? "text-xs opacity-15 font-light" : effect == "big" ? "text-2xl font-black" : "text-sm font-normal"} ${effect == "rotate" ? "rotate" : ""} ${effect == "ugly" ? "uglify" : ""} textColor select-text break-all">
					${escapeHtml(message, true)}
				</p>
			${effect == "marquee" ? "</marquee>" : ""}
		</div>
	</div>
</div>`
}

// Fonction pour échapper les caractères spéciaux
function escapeHtml(text, isTextMessage = false){
	if(!text) return text
	if(typeof text != "string") return text
	text = text?.replace(/&/g, "&amp;")?.replace(/</g, "&lt;")?.replace(/>/g, "&gt;")?.replace(/"/g, "&quot;")?.replace(/'/g, "&#039;").trim()
	if(isTextMessage) text = text.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s]+)/g, "<a href=\"$1\" target=\"_blank\" class=\"text-blue-500 dark:text-blue-400\">$1</a>")
	return text
}

// Fonction pour obtenir l'heure actuelle "HH:MM"
function getTime(){
	var date = new Date()
	var hours = date.getHours().toString()
	var minutes = date.getMinutes().toString()
	if(hours.length == 1) hours = `0${hours}`
	if(minutes.length == 1) minutes = `0${minutes}`
	return `${hours}:${minutes}`
}

// Fonction pour chiffrer du texte
async function encryptText(text, key, iv) {
	try {
		const encodedText = new TextEncoder().encode(text)
		const importedKey = await window.crypto.subtle.importKey(
			"raw",
			key,
			{ name: "AES-CBC" },
			false,
			["encrypt"]
		)

		const encrypted = await window.crypto.subtle.encrypt(
			{ name: "AES-CBC", iv: iv },
			importedKey,
			encodedText
		)

		// Convertir le tableau d'octets en une chaîne de caractères Base64
		return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
	} catch (err) {
		console.error(err)
		return null
	}
}
