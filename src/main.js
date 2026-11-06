/*
 * Gestion Multi-comptes — processus principal (Electron)
 * ------------------------------------------------------
 * Rôles de ce fichier :
 *   1. ouvrir la fenêtre de l'application ;
 *   2. créer une session de navigation isolée par compte (cookies séparés) ;
 *   3. permettre l'affichage intégré des sites, avec repli vers le
 *      navigateur par défaut quand un site le refuse ;
 *   4. lire / enregistrer les données de l'utilisateur (favoris, comptes
 *      ajoutés, préférences) dans %APPDATA%\Gestion Multi-comptes.
 *
 * Aucun mot de passe n'est manipulé ni enregistré par l'application :
 * les connexions se font directement sur les sites, dans leur propre
 * session Chromium.
 */

const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DOSSIER_SRC = __dirname;
const FICHIER_DONNEES = () => path.join(app.getPath('userData'), 'donnees.json');
const PREFIXE_SESSION = 'persist:compte-';

let fenetrePrincipale = null;

// Une seule instance de l'application à la fois.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!fenetrePrincipale) return;
    if (fenetrePrincipale.isMinimized()) fenetrePrincipale.restore();
    fenetrePrincipale.focus();
  });
}

app.setName('Gestion Multi-comptes');
if (process.platform === 'win32') app.setAppUserModelId('ca.mm.gestionmulticomptes');
Menu.setApplicationMenu(null); // interface minimaliste : pas de barre de menus

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function estUrlWeb(url) {
  if (typeof url !== 'string' || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Identifiant de compte -> nom de partition valide et sans surprise. */
function nomPartition(idCompte) {
  const propre = String(idCompte || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return PREFIXE_SESSION + (propre || 'default');
}

function lireDonnees() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_DONNEES(), 'utf8'));
  } catch {
    return {};
  }
}

function ecrireDonnees(donnees) {
  const fichier = FICHIER_DONNEES();
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const temporaire = fichier + '.tmp';
  fs.writeFileSync(temporaire, JSON.stringify(donnees, null, 2), 'utf8');
  fs.renameSync(temporaire, fichier);
}

/* ------------------------------------------------------------------ */
/* Sessions des comptes                                                */
/* ------------------------------------------------------------------ */

const sessionsConfigurees = new Set();
const permissionsAccordees = new Map(); // "partition|permission|origine" -> bool

/**
 * User-agent « Chrome standard » : certains services refusent les
 * navigateurs intégrés s'ils se présentent comme Electron. On part du
 * vrai user-agent de Chromium et on retire seulement les mentions
 * « Electron » et le nom de l'application.
 */
function userAgentChrome() {
  const base = session.defaultSession.getUserAgent();
  const nomApp = app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nettoye = base
    .replace(/\s+Electron\/[\d.]+/gi, '')
    .replace(new RegExp('\\s+' + nomApp + '/[\\d.]+', 'gi'), '')
    .trim();
  return /Chrome\/[\d.]+/.test(nettoye) ? nettoye : base;
}

/**
 * Retire uniquement les protections anti-intégration (X-Frame-Options et
 * la directive CSP frame-ancestors) afin que le site puisse s'afficher
 * dans la fenêtre de l'application. Le reste de la politique de sécurité
 * du site est conservé tel quel.
 *
 * C'est ce que font les gestionnaires de comptes de type Rambox/Franz.
 * Si un site refuse malgré tout (page blanche, connexion bloquée),
 * l'interface bascule automatiquement vers le navigateur par défaut.
 */
function assouplirAntiIntegration(sess) {
  sess.webRequest.onHeadersReceived((details, callback) => {
    const entetes = details.responseHeaders;
    if (!entetes) return callback({});

    const estDocument = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
    if (!estDocument) return callback({});

    let modifie = false;
    for (const nom of Object.keys(entetes)) {
      const nomMin = nom.toLowerCase();

      if (nomMin === 'x-frame-options') {
        delete entetes[nom];
        modifie = true;
        continue;
      }

      if (nomMin === 'content-security-policy' || nomMin === 'content-security-policy-report-only') {
        const nouvelles = (entetes[nom] || [])
          .map((politique) =>
            politique
              .split(';')
              .filter((directive) => !/^\s*frame-ancestors\b/i.test(directive))
              .join(';')
              .trim()
          )
          .filter((politique) => politique.length > 0);
        if (nouvelles.length !== (entetes[nom] || []).length || nouvelles.join('|') !== (entetes[nom] || []).join('|')) {
          modifie = true;
          if (nouvelles.length) entetes[nom] = nouvelles;
          else delete entetes[nom];
        }
      }
    }

    callback(modifie ? { responseHeaders: entetes } : {});
  });
}

/** Permissions demandées par les sites (caméra/micro pour Zoom, etc.). */
function configurerPermissions(sess, partition) {
  const demander = new Set(['media', 'display-capture', 'geolocation', 'notifications', 'openExternal']);
  const autoriserSansDemande = new Set(['fullscreen', 'clipboard-sanitized-write', 'clipboard-read']);

  sess.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origine = (details && details.requestingUrl) || (webContents && webContents.getURL()) || '';
    const cle = `${partition}|${permission}|${origine}`;

    if (autoriserSansDemande.has(permission)) return callback(true);
    if (!demander.has(permission)) return callback(false);
    if (permissionsAccordees.has(cle)) return callback(permissionsAccordees.get(cle));

    const libelles = {
      media: 'la caméra et le microphone',
      'display-capture': "le partage d'écran",
      geolocation: 'votre position',
      notifications: 'les notifications',
      openExternal: "l'ouverture d'une application externe"
    };

    const options = {
      type: 'question',
      buttons: ['Autoriser', 'Refuser'],
      defaultId: 1,
      cancelId: 1,
      title: 'Demande d’autorisation',
      message: `Autoriser ${libelles[permission] || permission} ?`,
      detail: origine
    };
    const choix = fenetrePrincipale
      ? dialog.showMessageBoxSync(fenetrePrincipale, options)
      : dialog.showMessageBoxSync(options);
    const accorde = choix === 0;
    permissionsAccordees.set(cle, accorde);
    callback(accorde);
  });
}

function preparerSession(idCompte) {
  const partition = nomPartition(idCompte);
  const sess = session.fromPartition(partition);
  if (!sessionsConfigurees.has(partition)) {
    sess.setUserAgent(userAgentChrome());
    assouplirAntiIntegration(sess);
    configurerPermissions(sess, partition);
    sessionsConfigurees.add(partition);
  }
  return partition;
}

/* ------------------------------------------------------------------ */
/* Fenêtre                                                             */
/* ------------------------------------------------------------------ */

function creerFenetre() {
  const etat = lireDonnees().fenetre || {};
  const options = {
    width: Math.max(960, Number(etat.largeur) || 1180),
    height: Math.max(640, Number(etat.hauteur) || 800),
    minWidth: 900,
    minHeight: 600,
    title: 'Gestion Multi-comptes',
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(DOSSIER_SRC, '..', 'ressources', 'icone.ico'),
    webPreferences: {
      preload: path.join(DOSSIER_SRC, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true, // nécessaire à l'affichage intégré des comptes
      spellcheck: false
    }
  };
  if (Number.isFinite(etat.x) && Number.isFinite(etat.y)) {
    options.x = etat.x;
    options.y = etat.y;
  }

  fenetrePrincipale = new BrowserWindow(options);
  fenetrePrincipale.once('ready-to-show', () => fenetrePrincipale.show());
  fenetrePrincipale.loadFile(path.join(DOSSIER_SRC, 'renderer', 'index.html'));

  // L'application elle-même ne navigue jamais vers l'extérieur.
  fenetrePrincipale.webContents.setWindowOpenHandler(({ url }) => {
    if (estUrlWeb(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetrePrincipale.webContents.on('will-navigate', (evenement, url) => {
    if (!url.startsWith('file://')) {
      evenement.preventDefault();
      if (estUrlWeb(url)) shell.openExternal(url);
    }
  });

  // Verrouillage des <webview> : https seulement, aucun accès Node.
  fenetrePrincipale.webContents.on('will-attach-webview', (evenement, prefs, params) => {
    delete prefs.preload;
    delete prefs.preloadURL;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    const partitionValide = typeof params.partition === 'string' && params.partition.startsWith(PREFIXE_SESSION);
    if (!partitionValide || !/^https:\/\//i.test(params.src || '')) evenement.preventDefault();
  });

  fenetrePrincipale.on('close', () => {
    try {
      const limites = fenetrePrincipale.getNormalBounds();
      const donnees = lireDonnees();
      donnees.fenetre = { largeur: limites.width, hauteur: limites.height, x: limites.x, y: limites.y };
      ecrireDonnees(donnees);
    } catch {
      /* sans conséquence : on réouvrira avec la taille par défaut */
    }
  });

  fenetrePrincipale.on('closed', () => {
    fenetrePrincipale = null;
  });
}

/* ------------------------------------------------------------------ */
/* Communication avec l'interface                                      */
/* ------------------------------------------------------------------ */

ipcMain.handle('app:infos', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  plateforme: process.platform,
  dossierDonnees: app.getPath('userData')
}));

ipcMain.handle('session:preparer', (_evenement, idCompte) => preparerSession(idCompte));

ipcMain.handle('systeme:ouvrir', async (_evenement, url) => {
  if (!estUrlWeb(url)) throw new Error('Adresse refusée : ' + String(url).slice(0, 80));
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('donnees:lire', () => {
  const { fenetre, ...reste } = lireDonnees();
  return reste;
});

ipcMain.handle('donnees:ecrire', (_evenement, donnees) => {
  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) {
    throw new Error('Données invalides');
  }
  const existantes = lireDonnees();
  ecrireDonnees({ ...donnees, fenetre: existantes.fenetre });
  return true;
});

ipcMain.handle('sessions:effacer', async () => {
  const partitions = [...sessionsConfigurees];
  for (const partition of partitions) {
    await session.fromPartition(partition).clearStorageData();
  }
  permissionsAccordees.clear();
  return partitions.length;
});

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

// Les fenêtres popup (connexion Google, Microsoft, etc.) restent dans la
// session du compte pour que la connexion se termine correctement.
app.on('web-contents-created', (_evenement, contents) => {
  if (contents.getType() !== 'webview') return;

  contents.setWindowOpenHandler(({ url }) => {
    if (!estUrlWeb(url)) return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 560,
        height: 760,
        parent: fenetrePrincipale || undefined,
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        title: 'Connexion',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webviewTag: false
        }
      }
    };
  });
});

app.whenReady().then(() => {
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
