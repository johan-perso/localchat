const childProcess = require("child_process")
const fs = require("fs")
const path = require("path")
const archiver = require("archiver")
const htmlMinify = require("html-minifier").minify
const sqwish = require("sqwish")
const Terser = require("terser")
const version = require("./package.json").version

async function listFilesRecursively(dir){
	let results = []
	const list = fs.readdirSync(dir)
	for(let file of list){
		file = path.resolve(dir, file)
		const stat = fs.statSync(file)
		if (stat && stat.isDirectory()) results = results.concat(await listFilesRecursively(file))
		else results.push(file)
	}
	return results
}

async function minifyContent(string, language){
	var minified

	if(language == "js") minified = (await Terser.minify(string)).code
	else if(language == "css") minified = sqwish.minify(string)
	else if(language == "html") minified = htmlMinify(string, { useShortDoctype: true, removeStyleLinkTypeAttributes: true, removeScriptTypeAttributes: true, removeComments: true, minifyURLs: true, minifyJS: true, minifyCSS: true, caseSensitive: true, preserveLineBreaks: true, collapseWhitespace: true, continueOnParseError: true })
	else throw new Error(`Le langage ${language} n'est pas supporté`)

	return minified
}

async function main(){
	// Si le dossier release-builds n'existe pas, on le crée, sinon on le vide
	if(!fs.existsSync(path.join(__dirname, "release-builds"))) fs.mkdirSync(path.join(__dirname, "release-builds"))
	else {
		var files = fs.readdirSync(path.join(__dirname, "release-builds"))
		files.forEach(file => {
			fs.rmSync(path.join(__dirname, "release-builds", file), { recursive: true })
		})
	}

	// Build Tailwind CSS
	console.log("@@@@ npm run build_tailwindcss")
	childProcess.execSync("npm run build_tailwindcss")

	// Copier et minifier les fichiers nécessaires dans un dossier temporaire
	var filesToCopy = ["index.js", "package.json", "LICENSE", "src/fonts", "src/icons", "src/js", "src/libs", "src/chat.html", "src/notif.html", "src/style.css"]
	for(var i = 0; i < filesToCopy.length; i++){
		var filePath = path.join(__dirname, filesToCopy[i])
		var destPath = path.join(__dirname, "release-builds", "minified-temp", filesToCopy[i])

		if(!fs.existsSync(filePath)) throw new Error(`Le fichier ${filePath} n'existe pas`)
		if(!fs.existsSync(path.dirname(destPath))) fs.mkdirSync(path.dirname(destPath), { recursive: true })

		console.log(`@@@@ Copie: ${filePath} -> ${destPath}`)

		if(fs.lstatSync(filePath).isDirectory()){
			fs.mkdirSync(destPath, { recursive: true })
			var files = fs.readdirSync(filePath)
			for(var j = 0; j < files.length; j++){
				var fileName = files[j]
				if(fileName.endsWith(".html") || fileName.endsWith(".css") || fileName.endsWith(".js")) { // Minifier si c'est un fichier HTML, CSS ou JS
					var fileContent = fs.readFileSync(path.join(filePath, fileName), "utf-8")
					fileContent = await minifyContent(fileContent, fileName.split(".").pop())
					fs.writeFileSync(path.join(destPath, fileName), fileContent)
				} else { // Sinon, on copie simplement le fichier
					fs.copyFileSync(path.join(filePath, fileName), path.join(destPath, fileName))
				}
			}
		} else {
			if(filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) { // Minifier si c'est un fichier HTML, CSS ou JS
				var fileContent = fs.readFileSync(filePath, "utf-8")
				fileContent = filesToCopy[i].endsWith(".html") || filesToCopy[i].endsWith(".css") || filesToCopy[i].endsWith(".js") ? await minifyContent(fileContent, filesToCopy[i].split(".").pop()) : fileContent
				fs.writeFileSync(destPath, fileContent)
			} else { // Sinon, on copie simplement le fichier
				fs.copyFileSync(path.join(__dirname, filesToCopy[i]), destPath)
			}
		}
	}

	// Télécharger les node_modules
	console.log("@@@@ npm install --no-audit --progress=false --omit=dev")
	childProcess.execSync("npm install --no-audit --progress=false --omit=dev", { cwd: path.join(__dirname, "release-builds", "minified-temp") })

	// Supprimer les fichiers inutiles dans les nodes_modules
	var nodesDeletionPattern = ["history.md", "readme.md", "changelog.md", "changelog", ".yml", ".lock", ".log", ".ts", ".tsbuildinfo", ".map", ".npmignore", ".jshintrc", ".eslintrc", ".nycrc", "tsconfig.json"]
	var nodesModulesPath = path.join(__dirname, "release-builds", "minified-temp", "node_modules")
	var nodesModulesFiles = await listFilesRecursively(nodesModulesPath)
	nodesModulesFiles.forEach(file => {
		if(nodesDeletionPattern.some(e => file.toLowerCase().endsWith(e))) console.log(`@@@@ Suppression: ${file}`) && fs.rmSync(file)
	})

	// Exécuter quelques scripts
	var commands = [
		"npm run build-exe-x64",
		process.platform == "darwin" ? "npm run build-app-x64" : null,
		process.platform == "darwin" ? "npm run build-app-arm64" : null
	].filter(e => e != null)
	for(var i = 0; i < commands.length; i++){
		console.log(`@@@@ ${commands[i]}`)
		childProcess.execSync(commands[i])
	}

	// On build un fichier dmg pour macOS
	if(process.platform == "darwin"){
		var macOsSupportedArchs = [
			"arm64", "x64"
		]
		for(var i = 0; i < macOsSupportedArchs.length; i++){
			// On fait la commande
			var command = `npx create-dmg ${path.join(__dirname, "release-builds", `LocalChat-darwin-${macOsSupportedArchs[i]}`, "LocalChat.app")} release-builds`
			console.log(`@@@@ ${command}`)
			try { childProcess.execSync(command) } catch(e){}

			// On renomme le fichier dmg généré
			fs.renameSync(
				path.join(__dirname, "release-builds", `LocalChat ${version}.dmg`),
				path.join(__dirname, "release-builds", `LocalChat-${version}-macos-${macOsSupportedArchs[i]}.dmg`)
			)
		}
	} else console.log("@@@@ Pas de build pour macOS car on est pas sur macOS")

	// On compresse les dossiers (pour pouvoir les mettre sur GitHub)
	var releaseBuildsFiles = [
		{ platform: "win32", arch: "x64", input: path.join(__dirname, "release-builds", "LocalChat-win32-x64"), output: path.join(__dirname, "release-builds", `LocalChat-${version}-win32-x64.zip`) },
		process.platform == "darwin" ? { platform: "darwin", arch: "x64", input: path.join(__dirname, "release-builds", "LocalChat-darwin-x64"), output: path.join(__dirname, "release-builds", `LocalChat-${version}-macos-x64.zip`) } : null,
		process.platform == "darwin" ? { platform: "darwin", arch: "arm64", input: path.join(__dirname, "release-builds", "LocalChat-darwin-arm64"), output: path.join(__dirname, "release-builds", `LocalChat-${version}-macos-arm64.zip`) } : null
	].filter(e => e != null)
	for(var i = 0; i < releaseBuildsFiles.length; i++){
		console.log(`@@@@ Création du zip pour ${releaseBuildsFiles[i].platform} ${releaseBuildsFiles[i].arch}`)
		var archive = archiver("zip", { zlib: { level: 9 } })
		archive.pipe(fs.createWriteStream(releaseBuildsFiles[i].output))
		archive.directory(releaseBuildsFiles[i].input, false)
		await archive.finalize()
		console.log(`@@@@ Zip créé pour ${releaseBuildsFiles[i].platform} ${releaseBuildsFiles[i].arch}`)
	}

	// Nettoyage
	console.log("@@@@ Nettoyage")
	var files = fs.readdirSync(path.join(__dirname, "release-builds"))
	files.forEach(file => {
		if(!file.endsWith(".dmg") && !file.endsWith(".zip")) fs.rmSync(path.join(__dirname, "release-builds", file), { recursive: true })
	})
	console.log("@@@@ Nettoyage terminé")
}
main()