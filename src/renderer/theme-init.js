/*
 * Applique le thème avant le premier affichage, pour éviter un éclair
 * blanc au démarrage. Le choix est mis en cache dans localStorage ;
 * la valeur de référence reste celle des données de l'utilisateur
 * (recalée par app.js juste après).
 */
(function () {
  'use strict';
  try {
    var choix = localStorage.getItem('gestion-multi-comptes:theme') || 'systeme';
    var suitSysteme = choix !== 'clair' && choix !== 'sombre';
    var sombre =
      choix === 'sombre' ||
      (suitSysteme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = sombre ? 'sombre' : 'clair';
  } catch (erreur) {
    document.documentElement.dataset.theme = 'clair';
  }
})();
