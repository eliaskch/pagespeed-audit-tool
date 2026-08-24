# PageSpeed Audit Tool

Outil d'audit de performance autonome via l'API PageSpeed Insights.
Créé par [EK Development](https://github.com/eliaskch).

Contrairement à l'outil en ligne original, cette version fonctionne **100% côté client**. 
Vous devez fournir votre propre clé API Google PageSpeed Insights. Aucune donnée n'est envoyée à notre serveur : le navigateur communique directement avec les serveurs de Google.

## Fonctionnalités 🚀

- **Audit complet** : Analyse des performances sur Mobile et Desktop en parallèle.
- **Transparence totale** : L'état d'avancement réel est affiché avec un chronomètre. Les erreurs remontent proprement (quota épuisé, site indisponible, etc.).
- **Client Side Only** : L'API Key n'est stockée nulle part, elle est demandée dans l'interface et envoyée directement à Google. Aucun serveur intermédiaire ou base de données n'est utilisé.
- **Interface propre** : Affichage graphique des scores Lighthouse, des métriques Web Vitals, et des opportunités d'amélioration.

## Prérequis

- [Node.js](https://nodejs.org/) installé sur votre machine.
- Une clé d'API Google Cloud avec **PageSpeed Insights API** activée.

## Installation et Lancement 🛠️

1. **Cloner le projet ou le télécharger**
2. **Installer les dépendances** :
   ```bash
   npm install
   ```
3. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```
4. Ouvrez votre navigateur à l'adresse indiquée (ex: `http://localhost:5173`).

## Usage

1. Renseignez l'URL du site à auditer (ex: `https://mon-site.fr`).
2. Insérez votre clé API Google.
3. Cliquez sur "Mesurer" et patientez (généralement 20 à 60 secondes).

## Licence 📝

Ce projet est soumis à une **licence de paternité obligatoire**. 
Vous êtes libre d'utiliser, de modifier et de distribuer ce code, **à la condition absolue** de créditer l'auteur original, **EK Development**, avec un lien visible vers le projet d'origine ou notre site web.

Voir le fichier [LICENSE](./LICENSE) pour plus de détails.
