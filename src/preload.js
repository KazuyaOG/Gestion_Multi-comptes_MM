/*
 * Passerelle sécurisée entre l'interface et Windows.
 * L'interface n'a accès à rien d'autre que ces quelques fonctions.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gestionAPI', {
  mode: 'bureau',
  infos: () => ipcRenderer.invoke('app:infos'),
  preparerSession: (idCompte) => ipcRenderer.invoke('session:preparer', idCompte),
  ouvrirDansNavigateur: (url) => ipcRenderer.invoke('systeme:ouvrir', url),
  lireDonnees: () => ipcRenderer.invoke('donnees:lire'),
  ecrireDonnees: (donnees) => ipcRenderer.invoke('donnees:ecrire', donnees),
  effacerSessions: () => ipcRenderer.invoke('sessions:effacer'),
  lireTheme: () => ipcRenderer.invoke('theme:lire'),
  definirTheme: (choix) => ipcRenderer.invoke('theme:definir', choix),
  surThemeSysteme: (rappel) => ipcRenderer.on('theme:systeme', (_evenement, valeur) => rappel(valeur))
});
