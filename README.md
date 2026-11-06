# Gestion Multi-comptes

Petite application **Windows**, en français, simple et minimaliste, pour retrouver tous ses comptes au même endroit.

- **Page d'accueil** : trois catégories — **Email**, **Finance**, **Sociale**.
- **Page de chaque catégorie** : une **barre latérale** avec les comptes disponibles, et le site qui s'affiche à droite.
- **Bas de la page d'accueil** : un accès à la page **Sites favoris** (RDS.ca est déjà ajouté).

Chaque compte possède **sa propre session de navigation** : vous pouvez donc ouvrir deux comptes du même service sans qu'ils se marchent dessus.

---

## 1. Ce qu'il y a dedans

| Catégorie | Compte | Adresse ouverte |
| --- | --- | --- |
| Email | Outlook | `https://outlook.live.com/mail/` |
| Email | Gmail | `https://mail.google.com/mail/u/0/` |
| Finance | Banque Nationale | `https://app.bnc.ca/` (portail particuliers de bnc.ca) |
| Finance | PayPal | `https://www.paypal.com/myaccount/summary` |
| Sociale | Messenger | `https://www.messenger.com/` |
| Sociale | Zoom | `https://app.zoom.us/wc/home` |
| Favoris | RDS | `https://www.rds.ca/` |

Vous pouvez ajouter vos propres comptes (bouton **+ Ajouter un compte** dans la barre latérale) et vos propres favoris (**+ Ajouter un site**). Les éléments que vous ajoutez peuvent être retirés avec le petit **×**.

---

## 2. Installation sur un PC Windows

### Option A — Créer le `.exe` (recommandé)

1. Installez **Node.js LTS** depuis <https://nodejs.org> (une seule fois, installation par défaut).
2. Double-cliquez sur **`Creer-exe-Windows.bat`**.
3. Attendez 2 à 5 minutes. Le dossier `dist` s'ouvre automatiquement avec deux fichiers :
   - **`Gestion-Multi-comptes-Installation-1.0.0.exe`** → installateur en français, avec raccourci sur le Bureau et dans le menu Démarrer ;
   - **`Gestion-Multi-comptes-Portable-1.0.0.exe`** → aucune installation, se lance directement (pratique sur une clé USB).

Une fois le `.exe` créé, **Node.js n'est plus nécessaire** : l'application est autonome.

> **Avertissement Windows** : comme l'application n'est pas signée auprès de Microsoft, SmartScreen peut afficher « Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires → Exécuter quand même**. C'est normal pour une application maison.

### Option B — Lancer sans créer le `.exe`

Double-cliquez sur **`Lancer-application.bat`**. Au premier lancement, les composants s'installent, puis l'application s'ouvre. Node.js doit rester installé sur le PC pour cette option.

### En ligne de commande

```bat
npm install
npm start
```

---

## 3. Comment l'affichage des comptes fonctionne

Vous avez choisi l'affichage **dans l'application, avec repli automatique** :

1. Le site s'ouvre dans la partie droite de la fenêtre, dans sa session isolée.
2. Si le site **refuse** d'être affiché ailleurs que dans un vrai navigateur (page blanche, connexion bloquée, message « ce navigateur n'est pas sécuritaire »), l'application l'**ouvre automatiquement dans votre navigateur par défaut** et vous explique pourquoi.
3. Le bouton **Ouvrir dans le navigateur ↗** reste toujours disponible dans la barre d'outils.
4. La case **Toujours ouvrir ce compte dans le navigateur** mémorise votre choix compte par compte. Le bouton **Afficher dans l'application** permet de revenir en arrière.

Pour rendre l'affichage intégré possible, l'application retire uniquement deux protections anti-intégration des sites (`X-Frame-Options` et la directive `frame-ancestors`). **Le reste de leur politique de sécurité est conservé.** C'est le fonctionnement habituel des gestionnaires de comptes comme Rambox ou Franz.

**À savoir :** Google et Microsoft sont les plus susceptibles de refuser la connexion intégrée. Dans ce cas, la connexion se fait dans votre navigateur habituel, où vos sessions sont déjà reconnues. C'est prévu et automatique.

---

## 4. Thème clair / sombre

Un interrupteur **clair / sombre** est présent sur les trois pages :

- en bas de la **page d'accueil**, à côté de « À propos » ;
- en bas de la **barre latérale** des catégories ;
- en haut à droite de la page **Sites favoris**.

Un clic suffit pour passer d'un thème à l'autre, et le choix est **mémorisé** d'un lancement à l'autre.

### Suivre le thème de Windows

Par défaut, l'application suit Windows. Pour forcer un thème ou revenir au suivi automatique, ouvrez **À propos → Apparence** :

| Choix | Comportement |
| --- | --- |
| **Clair** | Toujours clair, peu importe Windows |
| **Sombre** | Toujours sombre, peu importe Windows |
| **Windows** | Suit Windows et change en direct quand le système bascule |

Le thème s'applique aussi aux boîtes de dialogue de Windows (demandes d'autorisation, confirmations) et à la couleur de fond de la fenêtre : aucun éclair blanc au démarrage en thème sombre.

> Les sites affichés dans l'application (Gmail, BNC, RDS…) gardent **leur propre apparence** — l'application ne modifie pas leur contenu. La plupart ont leur propre réglage sombre.

---

## 5. Sécurité et vie privée

- **Aucun mot de passe n'est enregistré par l'application.** Vous vous connectez directement sur le site du service, comme dans un navigateur.
- Les cookies de connexion restent **sur votre PC**, dans un dossier par compte.
- Les sites n'ont **aucun accès** à Node.js ni au système : isolation du contexte, sandbox, pas de script de préchargement.
- Seules les adresses `https://` sont acceptées, et impossible d'ouvrir autre chose que du `http`/`https` dans votre navigateur.
- La caméra, le micro, le partage d'écran et la position sont **refusés sauf si vous les autorisez** explicitement (utile pour Zoom).
- Le bouton **À propos → Effacer les connexions** vide tous les cookies des comptes, sans toucher à vos favoris.

### Où sont mes données ?

```
%APPDATA%\Gestion Multi-comptes\
```

- `donnees.json` → vos favoris, vos comptes ajoutés, votre thème, vos préférences et la taille de la fenêtre.
- Un dossier `Partitions` → les sessions de connexion, une par compte.

---

## 6. Raccourcis clavier

| Raccourci | Action |
| --- | --- |
| `Ctrl` + `1` / `2` / `3` | Ouvrir Email / Finance / Sociale |
| `Ctrl` + `R` | Recharger le site affiché |
| `Échap` | Revenir à l'accueil (ou fermer une fenêtre de dialogue) |

Le thème se change d'un clic sur le bouton lune/soleil, disponible sur toutes les pages.

*(Ces raccourcis agissent lorsque le curseur est dans l'interface de l'application, pas à l'intérieur d'un site.)*

---

## 7. Modifier les comptes d'usine

Tout se trouve dans un seul fichier, facile à lire : **`src/renderer/comptes.js`**.

```js
{
  id: 'bnc',
  categorie: 'finance',
  nom: 'Banque Nationale',
  url: 'https://app.bnc.ca/',
  note: 'Portail particuliers — bnc.ca',
  couleur: '#e02b30',
  initiale: 'BN'
}
```

Changez l'adresse, le nom ou la couleur, puis relancez l'application. Les comptes et favoris que vous ajoutez **depuis l'interface** sont, eux, enregistrés dans `donnees.json` et ne sont jamais écrasés.

---

## 8. Voir l'interface sans installer Electron

```bat
npm run apercu
```

Puis ouvrez <http://localhost:4173>. L'apparence et la navigation sont identiques ; seul l'affichage intégré des sites est propre à l'application Windows (dans l'aperçu, un clic ouvre un nouvel onglet).

---

## 9. Structure du projet

```
Gestion_Multi-comptes_MM/
├── Lancer-application.bat        → démarrer l'application (Windows)
├── Creer-exe-Windows.bat         → fabriquer les .exe (Windows)
├── package.json                  → configuration et empaquetage
├── ressources/
│   ├── icone.ico                 → icône de l'application
│   └── icone.png
├── src/
│   ├── main.js                   → fenêtre, sessions isolées, sécurité, données
│   ├── preload.js                → passerelle limitée entre l'interface et Windows
│   └── renderer/
│       ├── index.html            → accueil, pages latérales, favoris, dialogues
│       ├── styles.css            → apparence minimaliste, palettes claire et sombre
│       ├── theme-init.js         → applique le thème dès la première image
│       ├── comptes.js            → comptes et catégories par défaut
│       └── app.js                → navigation, affichage intégré, repli navigateur
├── tools/apercu.mjs              → aperçu de l'interface dans un navigateur
└── dist/                         → les .exe générés (non versionné)
```

**Technique :** Electron + HTML/CSS/JavaScript, sans framework. Aucune dépendance à l'exécution, aucun service externe, aucun télémétrage.
