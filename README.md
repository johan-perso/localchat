# LocalChat

Une application pour discuter au sein d'un réseau local, de manière décentralisée, sans avoir à utiliser une connexion à Internet.  
Chaque utilisateur ouvre un serveur local sur son appareil, les autres utilisateurs l'utiliseront pour lui envoyer un message. Si un serveur est coupé, seul celui qui l'hébergeait ne pourra plus communiquer.

> À la base c'était un projet pour profiter du réseau de mon lycée qui n'a pas d'accès à Internet, le projet ne sera sûrement pas mis à jour.  
> Projet basé sur le code source d'[Agendapp](https://github.com/johan-perso/agendapp), une application d'organisation des devoirs et de prise de notes.


## Installation

### Windows

* Téléchargez le fichier `LocalChat-*-win32-x64.zip` dans la section [Releases](https://github.com/johan-perso/localchat/releases/latest) de ce dépôt.
* Décompressez le fichier ZIP puis exécutez le fichier `LocalChat.exe` pour démarrer l'application.
* Vous pouvez créer un raccourci vers `LocalChat.exe` pour lancer l'application plus facilement.

### macOS

* Cherchez et téléchargez le fichier `LocalChat-*-macos-*.dmg` (en fonction de votre architecture, Intel = x64 ; Sillicon = arm64) dans la section [Releases](https://github.com/johan-perso/localchat/releases/latest) de ce dépôt.
* Ouvrez le fichier DMG puis déplacez l'application `LocalChat.app` dans le dossier Applications.

> Pour ouvrir ce fichier sur un processeur Apple Silicon (M1 et supérieur), vous devrez potentiellement exécuter ces commandes dans le terminal :

```bash
sudo spctl --master-disable
sudo chmod -R 777 /Applications/LocalChat.app
xattr -d com.apple.quarantine /Applications/LocalChat.app
xattr -cr /Applications/LocalChat.app
```


## Licence

MIT © [Johan](https://johanstick.fr).  
Icône fait par [Icones8](https://icones8.fr/icon/D6fq9I7xyv5X/chat-message).