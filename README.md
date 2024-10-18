# LocalChat

Une application pour discuter au sein d'un réseau local, de manière décentralisée, sans avoir à utiliser une connexion à Internet.  

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


## Fonctionnement technique

### Décentralisé

Lorsqu'un utilisateur envoie un message, le client (l'application) va envoyer une requête au serveur de chaque destinataire qui a été détecté sur le réseau local. Les destinataires qui recevront la requête afficheront le message dans l'interface avec les informations reçues.

Cette méthode offre plusieurs avantages : aucun serveur central n'est nécessaire pour communiquer, il est possible de discuter à plusieurs sans aucune configuration supplémentaire, une connexion à Internet n'est même pas requise.

### Sécurité

Les messages sont envoyés "en clair" (sans HTTPS) sur le réseau local. Des personnes malveillantes (ou simplement l'administration d'un établissement scolaire par exemple) pourraient potentiellement intercepter les messages. Pour cela, le contenu du message (n'incluant ni le pseudo ni l'effet utilisé) est chiffré en utilisant l'algorithme AES-256-CBC avec une clé générée aléatoirement à chaque message.

La clé permettant le déchiffrement, ainsi que l'IV (vecteur d'initialisation) sont envoyés en clair avec le message. Cependant, une information est ajoutée à la clé au moment du chiffrement, et n'est pas envoyée dans la requête, celle-ci est basée sur le temps ainsi qu'une valeur prédéfinie dans le code.

En conclusion, les messages peuvent être lus par des inconnus sur le réseau, mais il sera plus difficile pour eux s'ils n'ont pas accès à ce code source.


## Licence

MIT © [Johan](https://johanstick.fr).  
Icône faite par [Icones8](https://icones8.fr/icon/D6fq9I7xyv5X/chat-message).