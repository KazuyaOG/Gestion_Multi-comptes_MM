/* ==================================================================
   Gestion Multi-comptes — interface
   ------------------------------------------------------------------
   Le même code fonctionne :
     • dans l'application Windows (Electron) : les sites s'affichent
       dans la fenêtre, chacun dans sa session isolée ;
     • dans un navigateur (aperçu) : les sites s'ouvrent dans un onglet.
   ================================================================== */

(function () {
  'use strict';

  const { CATEGORIES, COMPTES_DEFAUT, FAVORIS_DEFAUT } = window.GestionCatalogue;

  const API = window.gestionAPI || null;
  const MODE_BUREAU = Boolean(API && API.mode === 'bureau');
  const CLE_STOCKAGE = 'gestion-multi-comptes:donnees';
  const DELAI_MAX_CHARGEMENT = 25000;

  /* ---------------------------------------------------------------- */
  /* Raccourcis DOM                                                    */
  /* ---------------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  const pages = {
    accueil: $('page-accueil'),
    laterale: $('page-laterale'),
    favoris: $('page-favoris')
  };

  const visionneuse = $('visionneuse');
  const voile = $('voile');
  const etatVide = $('etat-vide');
  const barreOutils = $('barre-outils');
  const barreProgression = $('barre-progression');

  /* ---------------------------------------------------------------- */
  /* État                                                              */
  /* ---------------------------------------------------------------- */
  let donnees = { favoris: [], comptes: [], preferences: {} };
  let pageActive = 'accueil';
  let contexteActuel = null; // 'email' | 'finance' | 'sociale' | 'favoris'
  let elementActuel = null; // compte ou favori affiché
  let elementVoile = null;
  let typeAjout = 'favori';

  const vues = new Map(); // id -> { webview, element, bloquee, repliFait, minuteur, prete }

  /* ---------------------------------------------------------------- */
  /* Icônes                                                            */
  /* ---------------------------------------------------------------- */
  const traits = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const ICONES = {
    enveloppe: `<svg viewBox="0 0 24 24" ${traits}><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>`,
    banque: `<svg viewBox="0 0 24 24" ${traits}><path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M5.5 10.5v7M9.5 10.5v7M14.5 10.5v7M18.5 10.5v7"/><path d="M3 19.5h18"/></svg>`,
    bulles: `<svg viewBox="0 0 24 24" ${traits}><path d="M20.5 12.2c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.42L5 19.5l1.1-3.05C4.5 15.3 3.5 13.85 3.5 12.2c0-3.6 3.6-6.5 8-6.5s9 2.9 9 6.5z"/></svg>`,
    etoile: `<svg viewBox="0 0 24 24" ${traits}><path d="M12 4.5l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 16.5l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77z"/></svg>`,
    alerte: `<svg viewBox="0 0 24 24" ${traits}><path d="M12 4.8L2.9 20h18.2z"/><path d="M12 10v4.2M12 17.2h.01"/></svg>`,
    externe: `<svg viewBox="0 0 24 24" ${traits}><path d="M14 4.5h5.5V10"/><path d="M19.5 4.5L11 13"/><path d="M18 14.5v3.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" ${traits}><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z"/></svg>`
  };

  const PALETTE = ['#3355dd', '#0e9f6e', '#7c3aed', '#d97706', '#0891b2', '#be185d', '#4f46e5', '#059669'];

  /* ---------------------------------------------------------------- */
  /* Petits utilitaires                                                */
  /* ---------------------------------------------------------------- */
  function teinte(hex, alpha) {
    const valeur = hex.replace('#', '');
    const r = parseInt(valeur.slice(0, 2), 16);
    const v = parseInt(valeur.slice(2, 4), 16);
    const b = parseInt(valeur.slice(4, 6), 16);
    return `rgba(${r}, ${v}, ${b}, ${alpha === undefined ? 0.1 : alpha})`;
  }

  function hoteDe(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /** Accepte « rds.ca » comme « https://www.rds.ca/ ». Refuse tout le reste. */
  function normaliserUrl(saisie) {
    let texte = String(saisie || '').trim();
    if (!texte) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(texte) && !/^https?:\/\//i.test(texte)) return null;
    if (!/^https?:\/\//i.test(texte)) texte = 'https://' + texte;
    try {
      const u = new URL(texte);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
      return u.href;
    } catch {
      return null;
    }
  }

  function initialeDe(nom) {
    const mots = String(nom || '?').trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return '?';
    if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
    return (mots[0][0] + mots[1][0]).toUpperCase();
  }

  function couleurPour(nom) {
    let total = 0;
    for (const c of String(nom)) total = (total + c.codePointAt(0)) % 997;
    return PALETTE[total % PALETTE.length];
  }

  function nouvelId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function completerElement(element) {
    return {
      ...element,
      initiale: element.initiale || initialeDe(element.nom),
      couleur: element.couleur || couleurPour(element.nom),
      note: element.note || hoteDe(element.url)
    };
  }

  function notification(message) {
    const bulle = document.createElement('div');
    bulle.className = 'notification';
    bulle.textContent = message;
    $('notifications').appendChild(bulle);
    setTimeout(() => bulle.remove(), 3600);
  }

  /* ---------------------------------------------------------------- */
  /* Données de l'utilisateur                                          */
  /* ---------------------------------------------------------------- */
  async function chargerDonnees() {
    let brut = {};
    try {
      brut = MODE_BUREAU
        ? (await API.lireDonnees()) || {}
        : JSON.parse(localStorage.getItem(CLE_STOCKAGE) || '{}');
    } catch {
      brut = {};
    }
    donnees.favoris = Array.isArray(brut.favoris)
      ? brut.favoris.filter((f) => f && f.nom && normaliserUrl(f.url)).map(completerElement)
      : FAVORIS_DEFAUT.map(completerElement);
    donnees.comptes = Array.isArray(brut.comptes)
      ? brut.comptes.filter((c) => c && c.nom && c.categorie && normaliserUrl(c.url)).map(completerElement)
      : [];
    donnees.preferences = brut.preferences && typeof brut.preferences === 'object' ? brut.preferences : {};
  }

  async function enregistrerDonnees() {
    const aJour = {
      favoris: donnees.favoris,
      comptes: donnees.comptes,
      preferences: donnees.preferences
    };
    try {
      if (MODE_BUREAU) await API.ecrireDonnees(aJour);
      else localStorage.setItem(CLE_STOCKAGE, JSON.stringify(aJour));
    } catch {
      notification('Impossible d’enregistrer les modifications.');
    }
  }

  function preference(id) {
    return donnees.preferences[id] || {};
  }

  function definirPreference(id, valeurs) {
    donnees.preferences[id] = { ...preference(id), ...valeurs };
    enregistrerDonnees();
  }

  function comptesDe(categorie) {
    return [
      ...COMPTES_DEFAUT.filter((c) => c.categorie === categorie),
      ...donnees.comptes.filter((c) => c.categorie === categorie)
    ].map(completerElement);
  }

  function elementsDe(contexte) {
    return contexte === 'favoris' ? donnees.favoris.map(completerElement) : comptesDe(contexte);
  }

  function categorieDe(contexte) {
    return CATEGORIES.find((c) => c.id === contexte) || null;
  }

  /* ---------------------------------------------------------------- */
  /* Navigation entre les pages                                        */
  /* ---------------------------------------------------------------- */
  function afficherPage(nom) {
    pageActive = nom;
    for (const [cle, page] of Object.entries(pages)) page.hidden = cle !== nom;
    if (nom !== 'laterale') {
      masquerToutesLesVues();
      voile.hidden = true;
    }
  }

  function allerAccueil() {
    contexteActuel = null;
    elementActuel = null;
    rendreAccueil();
    afficherPage('accueil');
  }

  function ouvrirContexte(contexte, idElement) {
    contexteActuel = contexte;
    elementActuel = null;
    rendreLaterale();
    afficherPage('laterale');
    barreOutils.hidden = true;
    barreProgression.hidden = true;
    voile.hidden = true;
    etatVide.hidden = false;
    masquerToutesLesVues();

    const liste = elementsDe(contexte);
    const choisi = idElement ? liste.find((e) => e.id === idElement) : null;
    if (choisi) selectionner(choisi);
    else if (contexte !== 'favoris' && liste.length) selectionner(liste[0]);
  }

  function allerFavoris() {
    rendreFavoris();
    afficherPage('favoris');
  }

  /* ---------------------------------------------------------------- */
  /* Accueil                                                           */
  /* ---------------------------------------------------------------- */
  function rendreAccueil() {
    const grille = $('grille-categories');
    grille.textContent = '';

    for (const categorie of CATEGORIES) {
      const comptes = comptesDe(categorie.id);
      const carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-categorie';
      carte.style.setProperty('--couleur-categorie', categorie.couleur);
      carte.style.setProperty('--fond-categorie', teinte(categorie.couleur));
      carte.setAttribute('aria-label', categorie.nom + ' — ' + categorie.description);
      carte.innerHTML =
        `<span class="carte-categorie-icone">${ICONES[categorie.icone]}</span>` +
        '<span class="categorie-titres"><span class="categorie-nom"></span><span class="categorie-description"></span></span>' +
        '<span class="carte-categorie-liste"></span>';
      carte.querySelector('.categorie-nom').textContent = categorie.nom;
      carte.querySelector('.categorie-description').textContent = categorie.description;

      const liste = carte.querySelector('.carte-categorie-liste');
      for (const compte of comptes.slice(0, 4)) {
        const jeton = document.createElement('span');
        jeton.className = 'jeton';
        const puce = document.createElement('span');
        puce.className = 'jeton-puce';
        puce.style.background = compte.couleur;
        puce.textContent = compte.initiale.slice(0, 1);
        const nom = document.createElement('span');
        nom.textContent = compte.nom;
        jeton.append(puce, nom);
        liste.appendChild(jeton);
      }
      if (comptes.length > 4) {
        const reste = document.createElement('span');
        reste.className = 'jeton';
        reste.textContent = '+' + (comptes.length - 4);
        liste.appendChild(reste);
      }

      carte.addEventListener('click', () => ouvrirContexte(categorie.id));
      grille.appendChild(carte);
    }

    const favoris = donnees.favoris;
    $('favoris-compteur').textContent = String(favoris.length);
    $('favoris-apercu').textContent = favoris.length
      ? favoris.slice(0, 3).map((f) => f.nom).join(' · ') + (favoris.length > 3 ? '…' : '')
      : 'Aucun site pour le moment';
  }

  /* ---------------------------------------------------------------- */
  /* Barre latérale                                                    */
  /* ---------------------------------------------------------------- */
  function rendreLaterale() {
    const contexte = contexteActuel;
    const categorie = categorieDe(contexte);
    const couleur = categorie ? categorie.couleur : '#b45309';

    $('laterale-puce').style.background = couleur;
    $('laterale-titre').textContent = categorie ? categorie.nom : 'Sites favoris';
    $('laterale-sous-titre').textContent = categorie ? categorie.description : 'Vos raccourcis personnels';
    $('texte-ajouter-laterale').textContent = categorie ? 'Ajouter un compte' : 'Ajouter un site';
    $('bouton-gerer-favoris').hidden = contexte !== 'favoris';

    const liste = $('liste-laterale');
    liste.textContent = '';
 liste.setAttribute('aria-label', categorie ? 'Comptes ' + categorie.nom : 'Sites favoris');

    for (const element of elementsDe(contexte)) {
      const ligne = document.createElement('div');
      ligne.className = 'ligne-laterale';

      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'element-laterale';
      bouton.dataset.id = element.id;
      bouton.style.setProperty('--couleur-categorie', couleur);
      bouton.style.setProperty('--fond-categorie', teinte(couleur));
      if (elementActuel && elementActuel.id === element.id) bouton.classList.add('actif');

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.style.background = element.couleur;
      avatar.textContent = element.initiale;

      const textes = document.createElement('span');
      textes.className = 'element-texte';
      const nom = document.createElement('span');
      nom.className = 'element-nom';
      nom.textContent = element.nom;
      const note = document.createElement('span');
      note.className = 'element-note';
      note.textContent = element.note;
      textes.append(nom, note);

      bouton.append(avatar, textes);

      if (preference(element.id).toujoursNavigateur) {
        const marque = document.createElement('span');
        marque.className = 'element-marque';
        marque.title = 'S’ouvre dans le navigateur';
        marque.textContent = '↗';
        bouton.appendChild(marque);
      }

      bouton.addEventListener('click', () => selectionner(element));
      ligne.appendChild(bouton);

      // Seuls les comptes ajoutés par l'utilisateur peuvent être retirés.
      const estPersonnel = contexte === 'favoris' || donnees.comptes.some((c) => c.id === element.id);
      if (estPersonnel) {
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.className = 'supprimer';
        supprimer.title = 'Retirer ' + element.nom;
        supprimer.setAttribute('aria-label', 'Retirer ' + element.nom);
        supprimer.textContent = '×';
        supprimer.addEventListener('click', (evenement) => {
          evenement.stopPropagation();
          retirerElement(contexte, element);
        });
        ligne.appendChild(supprimer);
      }

      liste.appendChild(ligne);
    }

    if (!elementsDe(contexte).length) {
      const vide = document.createElement('p');
      vide.className = 'liste-vide';
      vide.style.fontSize = '12.5px';
      vide.textContent = contexte === 'favoris' ? 'Aucun favori.' : 'Aucun compte.';
      liste.appendChild(vide);
    }
  }

  function marquerActif(id) {
    for (const bouton of $('liste-laterale').querySelectorAll('.element-laterale')) {
      bouton.classList.toggle('actif', bouton.dataset.id === id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Sélection d'un compte / favori                                    */
  /* ---------------------------------------------------------------- */
  async function selectionner(element) {
    elementActuel = element;
    elementVoile = element;
    marquerActif(element.id);
    etatVide.hidden = true;
    barreOutils.hidden = false;
    $('adresse-site').textContent = element.url;
    $('adresse-site').title = element.url;
    $('outil-navigateur').querySelector('.txt-bouton').textContent = MODE_BUREAU
      ? 'Ouvrir dans le navigateur'
      : 'Ouvrir dans un onglet';
    voile.hidden = true;
    masquerToutesLesVues();
    majOutilsNavigation();

    if (!MODE_BUREAU) {
      afficherVoile('apercu', element);
      return;
    }

    if (preference(element.id).toujoursNavigateur) {
      afficherVoile('navigateur', element);
      ouvrirExterne(element.url, element.nom + ' s’est ouvert dans votre navigateur.');
      return;
    }

    barreProgression.hidden = false;
    try {
      const entree = await obtenirVue(element);
      // L'utilisateur a peut-être changé de compte pendant la préparation.
      if (!elementActuel || elementActuel.id !== element.id) return;
      if (entree.bloquee) {
        barreProgression.hidden = true;
        afficherVoile(entree.raison || 'blocage', element);
        return;
      }
      montrerVue(entree);
      barreProgression.hidden = !entree.enChargement;
      majOutilsNavigation();
    } catch (erreur) {
      barreProgression.hidden = true;
      afficherVoile('blocage', element);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Vues intégrées (Electron)                                         */
  /* ---------------------------------------------------------------- */
  function masquerToutesLesVues() {
    for (const entree of vues.values()) entree.webview.style.display = 'none';
    barreProgression.hidden = true;
  }

  function montrerVue(entree) {
    for (const autre of vues.values()) autre.webview.style.display = autre === entree ? 'flex' : 'none';
    voile.hidden = true;
  }

  function estCourante(entree) {
    return Boolean(elementActuel && entree.element.id === elementActuel.id && pageActive === 'laterale');
  }

  async function obtenirVue(element) {
    if (vues.has(element.id)) return vues.get(element.id);

    const partition = await API.preparerSession(element.id);
    const webview = document.createElement('webview');
    webview.className = 'vue-site';
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('src', element.url);
    webview.style.display = 'none';

    const entree = {
      webview,
      element,
      bloquee: false,
      raison: null,
      repliFait: false,
      prete: false,
      enChargement: true,
      minuteur: null
    };
    vues.set(element.id, entree);
    brancherEvenements(entree);
    visionneuse.insertBefore(webview, voile);
    surveillerChargement(entree);
    return entree;
  }

  function surveillerChargement(entree) {
    clearTimeout(entree.minuteur);
    entree.minuteur = setTimeout(() => {
      if (!entree.prete && !entree.bloquee) signalerEchec(entree, 'delai');
    }, DELAI_MAX_CHARGEMENT);
  }

  function brancherEvenements(entree) {
    const vue = entree.webview;

    vue.addEventListener('did-start-loading', () => {
      entree.enChargement = true;
      if (estCourante(entree) && !entree.bloquee) barreProgression.hidden = false;
    });

    vue.addEventListener('did-stop-loading', () => {
      entree.enChargement = false;
      if (estCourante(entree)) {
        barreProgression.hidden = true;
        majOutilsNavigation();
        lireAdresse(entree);
      }
    });

    vue.addEventListener('dom-ready', () => {
      entree.prete = true;
      clearTimeout(entree.minuteur);
      if (estCourante(entree)) majOutilsNavigation();
      verifierContenu(entree);
    });

    vue.addEventListener('did-navigate', (evenement) => {
      if (estCourante(entree) && evenement.url) mettreAJourAdresse(evenement.url);
    });
    vue.addEventListener('did-navigate-in-page', (evenement) => {
      if (estCourante(entree) && evenement.url) mettreAJourAdresse(evenement.url);
    });

    vue.addEventListener('did-fail-load', (evenement) => {
      if (evenement.errorCode === -3 || evenement.isMainFrame === false) return; // navigation annulée
      entree.enChargement = false;
      const code = evenement.errorCode;
      const raison = code === -27 || code === -20 ? 'blocage' : 'reseau';
      entree.detailErreur = evenement.errorDescription || String(code);
      signalerEchec(entree, raison);
    });

    // Certains sites refusent l'intégration sans déclencher did-fail-load.
    vue.addEventListener('console-message', (...args) => {
      const message = (args[0] && args[0].message) || args[2] || '';
      if (typeof message !== 'string') return;
      if (/x-frame-options|frame-ancestors|refused to display|refuse d.aficher/i.test(message)) {
        signalerEchec(entree, 'blocage');
      }
    });
  }

  /** Détecte les pages « navigateur non sécuritaire » et les pages vides. */
  async function verifierContenu(entree) {
    const script = `(function () {
      var corps = document.body;
      var texte = corps ? (corps.innerText || '').slice(0, 3000) : '';
      return {
        titre: document.title || '',
        texte: texte,
        elements: corps ? corps.children.length : 0
      };
    })();`;

    let infos = null;
    try {
      infos = await entree.webview.executeJavaScript(script, true);
    } catch {
      return; // la vue a été détruite entre-temps
    }
    if (!infos || entree.bloquee) return;

    const bavard = (infos.titre + ' ' + infos.texte).toLowerCase();
    const refuse =
      /this browser or app may not be secure/.test(bavard) ||
      /ce navigateur ou cette application n.est pas sécuris/.test(bavard) ||
      /navigateur non sécuris/.test(bavard) ||
      /err_blocked_by_response/.test(bavard) ||
      /refused to connect|refuse de se connecter/.test(bavard);
    if (refuse) {
      signalerEchec(entree, 'connexion');
      return;
    }

    if (infos.elements === 0 && !infos.titre) {
      setTimeout(() => {
        if (!entree.bloquee) signalerEchec(entree, 'vide');
      }, 4000);
    }
  }

  function signalerEchec(entree, raison) {
    if (entree.bloquee) return;
    entree.bloquee = true;
    entree.raison = raison;
    entree.enChargement = false;
    clearTimeout(entree.minuteur);
    if (!estCourante(entree)) return;

    barreProgression.hidden = true;
    afficherVoile(raison, entree.element);

    if (!entree.repliFait && donnees.preferences.repliAutomatique !== false) {
      entree.repliFait = true;
      ouvrirExterne(entree.element.url, entree.element.nom + ' s’est ouvert dans votre navigateur.');
    }
    majOutilsNavigation();
  }

  function reessayer(element) {
    const entree = vues.get(element.id);
    voile.hidden = true;
    if (!entree) {
      selectionner(element);
      return;
    }
    entree.bloquee = false;
    entree.raison = null;
    entree.repliFait = false;
    entree.prete = false;
    entree.enChargement = true;
    montrerVue(entree);
    barreProgression.hidden = false;
    try {
      entree.webview.loadURL(element.url);
    } catch {
      entree.webview.setAttribute('src', element.url);
    }
    surveillerChargement(entree);
  }

  /* ---------------------------------------------------------------- */
  /* Barre d'outils                                                    */
  /* ---------------------------------------------------------------- */
  function vueCourante() {
    if (!MODE_BUREAU || !elementActuel) return null;
    const entree = vues.get(elementActuel.id);
    if (!entree || entree.bloquee || !entree.prete) return null;
    return entree;
  }

  function majOutilsNavigation() {
    const entree = vueCourante();
    const disponible = Boolean(entree);
    $('outil-recharger').disabled = !disponible;
    try {
      $('outil-precedent').disabled = !disponible || !entree.webview.canGoBack();
      $('outil-suivant').disabled = !disponible || !entree.webview.canGoForward();
    } catch {
      $('outil-precedent').disabled = true;
      $('outil-suivant').disabled = true;
    }
  }

  function mettreAJourAdresse(url) {
    $('adresse-site').textContent = url;
    $('adresse-site').title = url;
  }

  function lireAdresse(entree) {
    try {
      const url = entree.webview.getURL();
      if (url) mettreAJourAdresse(url);
    } catch {
      /* vue pas encore prête */
    }
  }

  async function ouvrirExterne(url, message) {
    try {
      if (MODE_BUREAU) await API.ouvrirDansNavigateur(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
      if (message) notification(message);
    } catch {
      notification('Impossible d’ouvrir le site.');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Voile d'information / repli                                       */
  /* ---------------------------------------------------------------- */
  const MESSAGES = {
    blocage: {
      titre: 'Affichage intégré refusé',
      texte: 'Ce site n’autorise pas son affichage à l’intérieur d’une autre application. Il s’ouvre donc dans votre navigateur par défaut, où vos connexions habituelles fonctionnent.'
    },
    connexion: {
      titre: 'Connexion refusée dans l’application',
      texte: 'Ce service refuse la connexion depuis un navigateur intégré. Continuez dans votre navigateur habituel : votre session y est déjà reconnue.'
    },
    reseau: {
      titre: 'Site inaccessible',
      texte: 'La page n’a pas pu être chargée. Vérifiez votre connexion, réessayez, ou ouvrez le site dans votre navigateur.'
    },
    delai: {
      titre: 'Le site ne répond pas',
      texte: 'Le chargement est anormalement long. Vous pouvez réessayer ou poursuivre dans votre navigateur.'
    },
    vide: {
      titre: 'La page reste vide',
      texte: 'Le site ne s’affiche pas correctement dans l’application. Ouvrez-le dans votre navigateur pour continuer.'
    },
    navigateur: {
      titre: 'Ouvert dans le navigateur',
      texte: 'Vous avez choisi d’ouvrir ce compte dans votre navigateur par défaut. Vous pouvez changer d’avis à tout moment.'
    },
    apercu: {
      titre: 'Aperçu dans le navigateur',
      texte: 'Ceci est l’aperçu de l’interface. Dans l’application Windows, le site s’affiche directement ici ; dans cet aperçu, il s’ouvre dans un nouvel onglet.'
    }
  };

  function afficherVoile(raison, element, detail) {
    const message = MESSAGES[raison] || MESSAGES.blocage;
    elementVoile = element;
    $('voile-icone').innerHTML =
      raison === 'navigateur' ? ICONES.externe : raison === 'apercu' ? ICONES.globe : ICONES.alerte;
    $('voile-titre').textContent = message.titre;
    $('voile-texte').textContent = message.texte + (detail ? ' (' + detail + ')' : '');
    $('voile-adresse').textContent = element ? element.nom + ' — ' + element.url : '';

    const ouvrir = $('voile-ouvrir');
    const reessayerBtn = $('voile-reessayer');
    const option = $('voile-option');
    const toujours = $('voile-toujours');

    ouvrir.textContent = MODE_BUREAU ? 'Ouvrir dans le navigateur' : 'Ouvrir dans un nouvel onglet';
    reessayerBtn.hidden = raison === 'apercu';
    reessayerBtn.textContent = raison === 'navigateur' ? 'Afficher dans l’application' : 'Réessayer ici';
    option.hidden = raison === 'apercu' || !MODE_BUREAU;
    toujours.checked = Boolean(element && preference(element.id).toujoursNavigateur);
    voile.hidden = false;
  }

  /* ---------------------------------------------------------------- */
  /* Favoris                                                           */
  /* ---------------------------------------------------------------- */
  function rendreFavoris() {
    const grille = $('grille-favoris');
    grille.textContent = '';
    $('favoris-vide').hidden = donnees.favoris.length > 0;

    for (const favori of donnees.favoris) {
      const carte = document.createElement('div');
      carte.className = 'carte-favori';
      carte.tabIndex = 0;
      carte.setAttribute('role', 'button');
      carte.title = 'Ouvrir ' + favori.nom;

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.style.background = favori.couleur;
      avatar.textContent = favori.initiale;

      const textes = document.createElement('span');
      textes.className = 'carte-favori-texte';
      const nom = document.createElement('span');
      nom.className = 'carte-favori-nom';
      nom.textContent = favori.nom;
      const hote = document.createElement('span');
      hote.className = 'carte-favori-hote';
      hote.textContent = hoteDe(favori.url);
      textes.append(nom, hote);

      const ouvrir = () => ouvrirContexte('favoris', favori.id);
      carte.addEventListener('click', ouvrir);
      carte.addEventListener('keydown', (evenement) => {
        if (evenement.key === 'Enter' || evenement.key === ' ') {
          evenement.preventDefault();
          ouvrir();
        }
      });

      const supprimer = document.createElement('button');
      supprimer.type = 'button';
      supprimer.className = 'supprimer';
      supprimer.title = 'Retirer ' + favori.nom;
      supprimer.setAttribute('aria-label', 'Retirer ' + favori.nom);
      supprimer.textContent = '×';
      supprimer.addEventListener('click', (evenement) => {
        evenement.stopPropagation();
        retirerElement('favoris', favori);
      });

      carte.append(avatar, textes, supprimer);
      grille.appendChild(carte);
    }
  }

  function retirerElement(contexte, element) {
    const libelle = contexte === 'favoris' ? 'des favoris' : 'de la catégorie';
    if (!window.confirm(`Retirer « ${element.nom} » ${libelle} ?`)) return;

    if (contexte === 'favoris') donnees.favoris = donnees.favoris.filter((f) => f.id !== element.id);
    else donnees.comptes = donnees.comptes.filter((c) => c.id !== element.id);
    delete donnees.preferences[element.id];

    const entree = vues.get(element.id);
    if (entree) {
      clearTimeout(entree.minuteur);
      entree.webview.remove();
      vues.delete(element.id);
    }
    if (elementActuel && elementActuel.id === element.id) {
      elementActuel = null;
      voile.hidden = true;
      barreOutils.hidden = true;
      etatVide.hidden = false;
    }

    enregistrerDonnees();
    if (pageActive === 'favoris') rendreFavoris();
    if (pageActive === 'laterale') rendreLaterale();
    rendreAccueil();
    notification(element.nom + ' retiré.');
  }

  /* ---------------------------------------------------------------- */
  /* Dialogue d'ajout                                                  */
  /* ---------------------------------------------------------------- */
  function ouvrirAjout(type) {
    typeAjout = type;
    const categorie = categorieDe(contexteActuel);
    $('ajout-titre').textContent = type === 'favori' ? 'Ajouter un site favori' : 'Ajouter un compte';
    $('ajout-aide').textContent =
      type === 'favori'
        ? 'Le site apparaîtra dans vos favoris.'
        : 'Le compte sera ajouté à la catégorie « ' + (categorie ? categorie.nom : '') + ' », avec sa propre session de connexion.';
    $('ajout-nom').value = '';
    $('ajout-url').value = '';
    $('ajout-erreur').hidden = true;
    $('dialogue-ajout').showModal();
    $('ajout-nom').focus();
  }

  function validerAjout(evenement) {
    evenement.preventDefault();
    const nom = $('ajout-nom').value.trim();
    const url = normaliserUrl($('ajout-url').value);
    const erreur = $('ajout-erreur');

    if (!nom || !url) {
      erreur.textContent = !nom ? 'Indiquez un nom.' : 'Adresse invalide. Exemple : rds.ca ou https://www.rds.ca/';
      erreur.hidden = false;
      return;
    }

    const element = completerElement({ id: nouvelId(), nom, url });
    if (typeAjout === 'favori') {
      donnees.favoris.push(element);
    } else {
      element.categorie = contexteActuel;
      donnees.comptes.push(element);
    }
    enregistrerDonnees();
    $('dialogue-ajout').close();
    rendreAccueil();

    if (pageActive === 'favoris' && typeAjout === 'favori') rendreFavoris();
    if (pageActive === 'laterale') {
      rendreLaterale();
      selectionner(element);
    }
    notification(nom + ' ajouté.');
  }

  /* ---------------------------------------------------------------- */
  /* Dialogue « À propos »                                             */
  /* ---------------------------------------------------------------- */
  async function ouvrirInfos() {
    $('infos-effacer').hidden = !MODE_BUREAU;
    $('dialogue-infos').showModal();
    if (MODE_BUREAU) {
      try {
        const infos = await API.infos();
        $('infos-version').textContent = 'v' + infos.version;
        $('infos-dossier').textContent = 'Données : ' + infos.dossierDonnees;
      } catch {
        /* rien d'essentiel */
      }
    } else {
      $('infos-version').textContent = '— aperçu navigateur';
      $('infos-dossier').textContent = 'Les favoris de cet aperçu sont enregistrés dans ce navigateur seulement.';
    }
  }

  async function effacerConnexions() {
    if (!window.confirm('Effacer toutes les connexions enregistrées (cookies des comptes) ? Vos favoris et vos comptes sont conservés.')) return;
    try {
      await API.effacerSessions();
      for (const entree of vues.values()) {
        clearTimeout(entree.minuteur);
        entree.webview.remove();
      }
      vues.clear();
      elementActuel = null;
      voile.hidden = true;
      barreOutils.hidden = true;
      etatVide.hidden = false;
      $('dialogue-infos').close();
      notification('Connexions effacées.');
    } catch {
      notification('Impossible d’effacer les connexions.');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Branchements                                                      */
  /* ---------------------------------------------------------------- */
  function brancherInterface() {
    $('bouton-favoris').addEventListener('click', allerFavoris);
    $('bouton-infos').addEventListener('click', ouvrirInfos);
    $('bouton-ajouter-favori').addEventListener('click', () => ouvrirAjout('favori'));
    $('bouton-ajouter-laterale').addEventListener('click', () =>
      ouvrirAjout(contexteActuel === 'favoris' ? 'favori' : 'compte')
    );
    $('bouton-gerer-favoris').addEventListener('click', allerFavoris);

    for (const bouton of document.querySelectorAll('[data-retour]')) {
      bouton.addEventListener('click', allerAccueil);
    }

    $('formulaire-ajout').addEventListener('submit', validerAjout);
    $('ajout-annuler').addEventListener('click', () => $('dialogue-ajout').close());
    $('infos-fermer').addEventListener('click', () => $('dialogue-infos').close());
    $('infos-effacer').addEventListener('click', effacerConnexions);

    $('outil-navigateur').addEventListener('click', () => {
      if (!elementActuel) return;
      const entree = MODE_BUREAU ? vues.get(elementActuel.id) : null;
      let url = elementActuel.url;
      if (entree && entree.prete && !entree.bloquee) {
        try {
          url = entree.webview.getURL() || url;
        } catch {
          /* adresse de départ */
        }
      }
      ouvrirExterne(url, 'Ouvert dans ' + (MODE_BUREAU ? 'votre navigateur.' : 'un nouvel onglet.'));
    });

    $('outil-recharger').addEventListener('click', () => {
      const entree = vueCourante();
      if (!entree) return;
      barreProgression.hidden = false;
      entree.webview.reload();
    });
    $('outil-precedent').addEventListener('click', () => {
      const entree = vueCourante();
      if (entree && entree.webview.canGoBack()) entree.webview.goBack();
    });
    $('outil-suivant').addEventListener('click', () => {
      const entree = vueCourante();
      if (entree && entree.webview.canGoForward()) entree.webview.goForward();
    });

    $('voile-ouvrir').addEventListener('click', () => {
      if (elementVoile) ouvrirExterne(elementVoile.url, null);
    });
    $('voile-reessayer').addEventListener('click', () => {
      if (!elementVoile) return;
      if (preference(elementVoile.id).toujoursNavigateur) definirPreference(elementVoile.id, { toujoursNavigateur: false });
      rendreLaterale();
      elementActuel = elementVoile;
      marquerActif(elementVoile.id);
      reessayer(elementVoile);
    });
    $('voile-toujours').addEventListener('change', (evenement) => {
      if (!elementVoile) return;
      definirPreference(elementVoile.id, { toujoursNavigateur: evenement.target.checked });
      rendreLaterale();
      notification(
        evenement.target.checked
          ? elementVoile.nom + ' s’ouvrira dans le navigateur.'
          : elementVoile.nom + ' s’ouvrira dans l’application.'
      );
    });

    document.addEventListener('keydown', (evenement) => {
      const dialogueOuvert = document.querySelector('dialog[open]');
      if (evenement.key === 'Escape' && !dialogueOuvert && pageActive !== 'accueil') {
        allerAccueil();
        return;
      }
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'r') {
        const entree = vueCourante();
        if (entree) {
          evenement.preventDefault();
          barreProgression.hidden = false;
          entree.webview.reload();
        }
        return;
      }
      if (evenement.ctrlKey && ['1', '2', '3'].includes(evenement.key) && !dialogueOuvert) {
        evenement.preventDefault();
        ouvrirContexte(CATEGORIES[Number(evenement.key) - 1].id);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                         */
  /* ---------------------------------------------------------------- */
  async function demarrer() {
    await chargerDonnees();
    brancherInterface();
    $('mode-etiquette').textContent = MODE_BUREAU ? '' : 'Aperçu navigateur';
    rendreAccueil();
    afficherPage('accueil');
  }

  demarrer();
})();
