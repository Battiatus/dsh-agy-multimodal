<h1 align="center">dsh-gemini-antigravity-auth</h1>

<p align="center"><strong>Gemini dans DeepSeek Harness, avec votre abonnement Google Antigravity.</strong><br>
Connectez-vous avec Google, choisissez un modèle Gemini, et votre agent cherche sur le web et comprend images, audio, vidéo et PDF.</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#fonctionnalités">Fonctionnalités</a> ·
  <a href="#utilisation">Utilisation</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="README.md">English</a>
</p>

---

**dsh-gemini-antigravity-auth** est un plugin [DeepSeek Harness](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) (DSH) qui ajoute les modèles Google **Gemini** via l'OAuth **Google Antigravity**. Pas de clé API, pas d'outil en plus : vous vous connectez avec votre compte Google et les modèles Gemini apparaissent dans le sélecteur de modèles de DSH, à côté de vos autres fournisseurs.

## Fonctionnalités

- 🔐 **Connexion Google (OAuth)** : un clic dans les réglages ou `/agy login`. Aucune clé API à copier.
- 🤖 **Vos modèles Gemini, détectés automatiquement** : le sélecteur affiche exactement les modèles Gemini inclus dans votre abonnement Antigravity (par exemple Gemini 3.8 Flash avec réflexion low / medium / high), lus sur votre compte à la connexion.
- 👥 **Plusieurs comptes Google** : ajouter, changer, retirer, et voir le quota restant de chacun avec son heure de remise à zéro.
- 🖼️ **Pièces jointes multimodales** : images, audio, vidéo et PDF joints au message partent tels quels vers Gemini.
- 🔎 **Outil `agy_web_search`** : recherche Google avec sources, utilisable par tous les agents.
- 🎬 **Outil `agy_media`** : l'agent analyse un fichier image, audio, vidéo ou PDF du dossier de travail (~36 Mo max).
- 🎛️ **Interrupteurs d'accès** : activer ou couper les modèles Gemini, la recherche web ou l'analyse de médias, et masquer les modèles inutiles.
- 🧩 **Compatible avec les outils DSH** : appels d'outils complets, schémas adaptés à ce que Gemini accepte.

## Installation

Fermez DeepSeek Harness, puis lancez :

```bash
dsh plugin --profile desktop add gemini-dsh
```

Relancez DeepSeek Harness. C'est tout.

Vous installez depuis l'écran des plugins de l'application ? Collez l'adresse complète :

```text
git+https://github.com/Battiatus/dsh-gemini-antigravity-auth.git
```

> **`dsh: command not found` ?** La commande est fournie avec l'application :
> `"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"`.
> Changez `--profile` (par exemple `web` ou `tui`) pour l'installer dans un autre profil DSH.

**Mettre à jour**

```bash
dsh plugin --profile desktop update gemini-dsh
```

**Désinstaller**

```bash
dsh plugin --profile desktop remove gemini-dsh
```

## Utilisation

1. Ouvrez **Réglages › Antigravity (Gemini)** et cliquez sur **Sign in with Google** (l'interface est en anglais) (ou tapez `/agy login`).
2. Validez la connexion dans votre navigateur.
3. Choisissez un modèle **Gemini (Antigravity)** dans le sélecteur et discutez.

### Commande `/agy`

| Commande | Effet |
| --- | --- |
| `/agy login` | Ajouter un compte Google |
| `/agy status` | Lister les comptes, l'actif est marqué ● |
| `/agy use <email>` | Changer de compte actif |
| `/agy logout [email]` | Retirer un compte (l'actif par défaut) |

### Outils de l'agent

| Outil | Effet |
| --- | --- |
| `agy_web_search` | Cherche sur Google et répond avec ses sources |
| `agy_media` | Décrit, transcrit ou analyse un fichier image, audio, vidéo ou PDF du dossier de travail |

## FAQ

**C'est officiel ?**
Non. Le plugin utilise la même connexion que Google Antigravity. Google a déjà suspendu des comptes branchés ainsi dans des outils tiers : à vos risques.

**Où sont mes jetons ?**
Uniquement sur votre machine, dans `~/.dsh/agy-multimodal/accounts.json` (droits `0600`), jamais affichés. Les réglages d'accès sont dans `settings.json` à côté.

**La connexion échoue à cause d'un port.**
La connexion écoute brièvement sur `127.0.0.1:51121`, le port imposé par Google pour ce client. Si un autre outil Antigravity l'occupe au même moment, `/agy login` le signale. Fermez cet outil et réessayez.

**J'ai une erreur 400 sur les schémas d'outils.**
Mettez le plugin à jour : les versions récentes convertissent les schémas multi-types et en tuple dans une forme que Gemini accepte.

## Développement

```bash
git clone https://github.com/Battiatus/dsh-gemini-antigravity-auth.git
cd dsh-gemini-antigravity-auth && npm install && npm test
dsh plugin --profile desktop add link:$PWD
```

Avec `link:`, DSH charge le plugin depuis votre clone : une modification du code s'applique au prochain lancement de DSH.

Basé sur [`@cortexkit/antigravity-auth-core`](https://www.npmjs.com/package/@cortexkit/antigravity-auth-core) (MIT).

## Licence

[MIT](LICENSE)
