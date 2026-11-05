# dsh-agy-multimodal

Plugin DeepSeek Harness : les modèles Gemini de votre abonnement Google Antigravity, connectés par OAuth Google.

- **Modèles** : Gemini 4 Argon, Gemini 3.8 Flash, Gemini 3.5 Flash (fournisseur « Gemini (Antigravity) », réflexion low/medium/high).
- **Fichiers joints** : images, plus audio, vidéo et PDF joints au message, envoyés tels quels à Gemini.
- **Outils de l'agent** : `agy_web_search` (Google Search, avec sources) et `agy_media` (analyse d'un fichier image/audio/vidéo/PDF du dossier de travail, ~36 Mo max).
- **Écran Réglages › Antigravity (Gemini)** :
  - plusieurs comptes Google : ajouter, choisir l'actif, retirer ;
  - quotas restants par compte (groupe Gemini et chaque modèle, avec l'heure de remise à zéro) ;
  - accès : interrupteurs pour les modèles Gemini, la recherche web et l'analyse de médias, et choix des modèles visibles.
- **Commande** : `/agy login | status | use <email> | logout [email]`.

Canal non officiel : Google a déjà suspendu des comptes branchés ainsi dans des outils tiers.

## Installation

Quittez DeepSeek Harness (⌘Q), puis une seule commande :

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add github:Battiatus/dsh-agy-multimodal
```

DSH clone le dépôt, installe les dépendances et active le plugin dans le profil `desktop`.
Le dépôt est privé : la machine doit avoir accès à GitHub avec ce compte (`gh auth login`, ou une clé SSH).

Relancez DeepSeek Harness, ouvrez Réglages › Antigravity (Gemini) › « Se connecter avec Google » (ou tapez `/agy login`), puis choisissez un modèle « Gemini (Antigravity) ».

Mettre à jour (DSH fermé) :

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop update dsh-agy-multimodal
```

Désinstaller : même commande avec `remove dsh-agy-multimodal`.

Développement : `npm install` dans un clone local, puis `add link:<chemin du clone>` à la place de `add github:…` ; une modification du code est prise en compte au prochain lancement de DSH.

La connexion écoute brièvement sur `127.0.0.1:51121` (port imposé par Google pour ce client OAuth).
Si un autre outil Antigravity le tient au même moment, `/agy login` le signale ; réessayez après.
Les jetons sont dans `~/.dsh/agy-multimodal/accounts.json` (droits 0600), jamais affichés ; les réglages d'accès dans `settings.json` à côté.

## Tests

```bash
npm test
```

Dépendance : [`@cortexkit/antigravity-auth-core`](https://www.npmjs.com/package/@cortexkit/antigravity-auth-core) 3.0.30, licence MIT.
