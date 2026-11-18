#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWKT - serveur local
Sert les fichiers statiques du projet ET enregistre les rapports/journaux
envoyes par la page dans le dossier ./logs (cree au demarrage s'il n'existe pas,
reutilise s'il existe deja).

Usage :
    python3 server.py [port]          # port par defaut : 8080

Depuis la PS5, ouvrez http://<IP-du-PC>:<port>/ dans le navigateur, lancez les
tests, puis cliquez « Enregistrer sur le serveur » : le fichier atterrit dans logs/.
"""
import os
import re
import sys
import json
import datetime
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(ROOT, 'logs')
MAX_BODY = 32 * 1024 * 1024  # 32 Mo : garde-fou contre un corps surdimensionne
SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def ensure_logs_dir():
    """Cree ./logs s'il n'existe pas ; renvoie True si cree, False s'il existait deja."""
    if os.path.isdir(LOGS_DIR):
        return False
    os.makedirs(LOGS_DIR, exist_ok=True)
    return True


def safe_filename(name, fmt):
    base = SAFE.sub('_', (name or 'log')).strip('_') or 'log'
    base = base[:60]
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    ext = 'json' if fmt == 'json' else 'txt'
    return 'pswkt-%s-%s.%s' % (base, stamp, ext)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _json(self, code, obj):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlparse(self.path).path != '/api/save-log':
            self._json(404, {'ok': False, 'error': 'route inconnue'})
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json(413, {'ok': False, 'error': 'taille de corps invalide'})
            return

        body = self.rfile.read(length)
        q = parse_qs(urlparse(self.path).query)
        fmt = (q.get('format', ['txt'])[0] or 'txt').lower()
        name = q.get('name', ['log'])[0]

        ensure_logs_dir()
        fname = safe_filename(name, fmt)
        fpath = os.path.join(LOGS_DIR, fname)

        # Securite : on n'ecrit QUE dans LOGS_DIR.
        if not os.path.abspath(fpath).startswith(LOGS_DIR + os.sep):
            self._json(400, {'ok': False, 'error': 'nom de fichier invalide'})
            return

        try:
            with open(fpath, 'wb') as f:
                f.write(body)
        except OSError as exc:
            self._json(500, {'ok': False, 'error': 'ecriture impossible : %s' % exc})
            return

        rel = os.path.join('logs', fname)
        sys.stdout.write('[PSWKT] enregistre : %s (%d octets)\n' % (rel, len(body)))
        sys.stdout.flush()
        self._json(200, {'ok': True, 'path': rel, 'bytes': len(body)})

    def log_message(self, fmt, *args):
        # Silencieux pour le service statique (on ne log que les enregistrements).
        return


def main():
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print('Port invalide, utilisation de 8080.')
    created = ensure_logs_dir()
    print('[PSWKT] dossier logs : %s (%s)' % (LOGS_DIR, 'cree' if created else 'existant, reutilise'))
    httpd = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print('[PSWKT] serveur demarre : http://0.0.0.0:%d/  (Ctrl+C pour arreter)' % port)
    print('[PSWKT] depuis la PS5  : http://<IP-du-PC>:%d/' % port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n[PSWKT] arret.')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
