/*
 * Aperçu de l'interface dans un navigateur (sans Electron).
 * Usage : npm run apercu   →   http://localhost:4173
 *
 * Ce petit serveur ne sert que les fichiers de l'interface : il permet
 * de voir et valider l'apparence sans installer Electron. L'affichage
 * intégré des comptes, lui, n'existe que dans l'application Windows.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const serveur = http.createServer(async (requete, reponse) => {
  try {
    const url = new URL(requete.url, 'http://localhost');
    const chemin = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const fichier = path.join(RACINE, path.normalize(chemin).replace(/^([/\\])+/, ''));
    if (!fichier.startsWith(RACINE)) {
      reponse.writeHead(403).end('Accès refusé');
      return;
    }
    const contenu = await fs.readFile(fichier);
    reponse.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    reponse.end(contenu);
  } catch {
    reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
});

serveur.listen(PORT, '0.0.0.0', () => {
  console.log(`Aperçu de l'interface : http://localhost:${PORT}`);
});
