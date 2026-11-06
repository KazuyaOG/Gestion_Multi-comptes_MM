/*
 * Comptes par défaut de l'application.
 * ---------------------------------------------------------------
 * Ce fichier est le seul endroit à modifier pour changer une adresse
 * ou ajouter un compte « d'usine ». Les comptes ajoutés depuis
 * l'interface sont, eux, enregistrés dans le fichier de données de
 * l'utilisateur (voir main.js).
 *
 * Chaque compte possède sa propre session de navigation isolée :
 * on peut donc être connecté à deux comptes du même service en même
 * temps.
 */

const CATEGORIES = [
  {
    id: 'email',
    nom: 'Email',
    description: 'Vos boîtes de courriel',
    couleur: '#2563eb',
    icone: 'enveloppe'
  },
  {
    id: 'finance',
    nom: 'Finance',
    description: 'Banque et paiements',
    couleur: '#0e9f6e',
    icone: 'banque'
  },
  {
    id: 'sociale',
    nom: 'Sociale',
    description: 'Messages et rencontres',
    couleur: '#7c3aed',
    icone: 'bulles'
  }
];

const COMPTES_DEFAUT = [
  {
    id: 'outlook',
    categorie: 'email',
    nom: 'Outlook',
    url: 'https://outlook.live.com/mail/',
    note: 'Courriel Microsoft',
    couleur: '#0f6cbd',
    initiale: 'O'
  },
  {
    id: 'gmail',
    categorie: 'email',
    nom: 'Gmail',
    url: 'https://mail.google.com/mail/u/0/',
    note: 'Courriel Google',
    couleur: '#d93025',
    initiale: 'G'
  },
  {
    id: 'bnc',
    categorie: 'finance',
    nom: 'Banque Nationale',
    url: 'https://app.bnc.ca/',
    note: 'Portail particuliers — bnc.ca',
    couleur: '#e02b30',
    initiale: 'BN'
  },
  {
    id: 'paypal',
    categorie: 'finance',
    nom: 'PayPal',
    url: 'https://www.paypal.com/myaccount/summary',
    note: 'Sommaire du compte',
    couleur: '#003087',
    initiale: 'P'
  },
  {
    id: 'messenger',
    categorie: 'sociale',
    nom: 'Messenger',
    url: 'https://www.messenger.com/',
    note: 'Messages Facebook',
    couleur: '#0a7cff',
    initiale: 'M'
  },
  {
    id: 'zoom',
    categorie: 'sociale',
    nom: 'Zoom',
    url: 'https://app.zoom.us/wc/home',
    note: 'Réunions et clavardage',
    couleur: '#2d8cff',
    initiale: 'Z'
  }
];

const FAVORIS_DEFAUT = [
  {
    id: 'rds',
    nom: 'RDS',
    url: 'https://www.rds.ca/',
    note: 'Sports',
    couleur: '#00539b',
    initiale: 'R'
  }
];

// Catalogue partagé avec l'interface (app.js).
if (typeof window !== 'undefined') {
  window.GestionCatalogue = { CATEGORIES, COMPTES_DEFAUT, FAVORIS_DEFAUT };
}
// Export Node (tests automatisés).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES, COMPTES_DEFAUT, FAVORIS_DEFAUT };
}
