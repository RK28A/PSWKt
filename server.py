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


def safe_session_filename(session):
    """Nom de fichier stable pour l'enregistrement continu d'une session (append)."""
    base = SAFE.sub('_', (session or 'session')).strip('_') or 'session'
    base = base[:80]
    return 'pswkt-live-%s.txt' % base


def within_logs(fpath):
    return os.path.abspath(fpath).startswith(LOGS_DIR + os.sep)


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
        path = urlparse(self.path).path
        if path == '/api/save-log':
            self._handle_save()
        elif path == '/api/log-stream':
            self._handle_stream()
        else:
            self._json(404, {'ok': False, 'error': 'route inconnue'})

    def _read_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return None
        return self.rfile.read(length)

    # Enregistrement d'un rapport complet (un fichier horodate par appel).
    def _handle_save(self):
        body = self._read_body()
        if body is None:
            self._json(413, {'ok': False, 'error': 'taille de corps invalide'})
            return
        q = parse_qs(urlparse(self.path).query)
        fmt = (q.get('format', ['txt'])[0] or 'txt').lower()
        name = q.get('name', ['log'])[0]

        ensure_logs_dir()
        fname = safe_filename(name, fmt)
        fpath = os.path.join(LOGS_DIR, fname)
        if not within_logs(fpath):
            self._json(400, {'ok': False, 'error': 'nom de fichier invalide'})
            return
        try:
            with open(fpath, 'wb') as f:
                f.write(body)
                f.flush()
                os.fsync(f.fileno())
        except OSError as exc:
            self._json(500, {'ok': False, 'error': 'ecriture impossible : %s' % exc})
            return

        rel = os.path.join('logs', fname)
        sys.stdout.write('[PSWKT] enregistre : %s (%d octets)\n' % (rel, len(body)))
        sys.stdout.flush()
        self._json(200, {'ok': True, 'path': rel, 'bytes': len(body)})

    # Enregistrement CONTINU : ajoute le corps a la fin du fichier de session, et
    # force l'ecriture sur le disque (fsync) a chaque appel. Ainsi, si le navigateur
    # PS5 plante en plein test, le fichier contient deja TOUT jusqu'au test fautif,
    # dont la ligne "DEBUT <id>" ecrite juste avant son execution.
    def _handle_stream(self):
        body = self._read_body()
        if body is None:
            self._json(413, {'ok': False, 'error': 'taille de corps invalide'})
            return
        q = parse_qs(urlparse(self.path).query)
        session = q.get('session', ['session'])[0]
        truncate = q.get('init', ['0'])[0] in ('1', 'true', 'yes')

        ensure_logs_dir()
        fname = safe_session_filename(session)
        fpath = os.path.join(LOGS_DIR, fname)
        if not within_logs(fpath):
            self._json(400, {'ok': False, 'error': 'session invalide'})
            return
        try:
            mode = 'wb' if truncate else 'ab'
            with open(fpath, mode) as f:
                f.write(body)
                f.flush()
                os.fsync(f.fileno())      # garantit la persistance avant un eventuel crash
            size = os.path.getsize(fpath)
        except OSError as exc:
            self._json(500, {'ok': False, 'error': 'ajout impossible : %s' % exc})
            return

        rel = os.path.join('logs', fname)
        if truncate:
            sys.stdout.write('[PSWKT] session continue : %s\n' % rel)
            sys.stdout.flush()
        self._json(200, {'ok': True, 'path': rel, 'bytes': len(body), 'total': size})

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
