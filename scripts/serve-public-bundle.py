"""Serve the exported read-only site with its documented static-host rewrites."""
import argparse
import gzip
import io
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--directory', default='output/SIMULATED_monad_site')
parser.add_argument('--port', type=int, default=49310)
args = parser.parse_args()
root = Path(args.directory).resolve()
if not (root / 'SIMULATED_hosting_manifest.json').is_file():
    raise ValueError('A completed public hosting bundle is required')

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path=Path(self.translate_path(self.path))
        if 'gzip' in self.headers.get('Accept-Encoding','') and path.is_file() and path.suffix in ['.html','.js','.css','.json','.svg']:
            body=gzip.compress(path.read_bytes(),mtime=0)
            self.send_response(200)
            self.send_header('Content-Type',self.guess_type(str(path)))
            self.send_header('Content-Encoding','gzip')
            self.send_header('Vary','Accept-Encoding')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def do_GET(self):
        path = urlsplit(self.path).path
        aliases = {'/operator/config': '/operator/config.json', '/api/rounds': '/api/rounds.json',
                   '/api/deployment': '/api/deployment.json', '/api/health': '/api/health.json'}
        if path in aliases:
            self.path = aliases[path]
        elif re.fullmatch(r'/api/rounds/\d+(?:/evidence)?', path):
            self.path = path + '.json'
        elif not path.startswith(('/api/', '/operator/', '/assets/', '/data/', '/images/', '/fonts/')) and not (root / path.lstrip('/')).is_file():
            self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, *_):
        pass

print(f'Public bundle preview: http://127.0.0.1:{args.port}', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root))).serve_forever()
