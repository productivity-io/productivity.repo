"""Opt-in real ECHO backend, no fake engine. Secrets stay in this process."""
import json
import os
from pathlib import Path
import sys

source = Path(os.environ['ECHO_SOURCE_ROOT']).resolve()
sys.path.insert(0, str(source / 'echo-web'))
from backend.server import ApiServer
from core.config import load_clients

key = os.environ.get('ECHO_MODEL_API_KEY', '')
url = os.environ.get('ECHO_MODEL_BASE_URL', '')
if os.environ.get('ECHO_USE_DESKTOP_SETTINGS') == 'true':
    sys.path.insert(0, str(source / 'desktop' / 'EchoDesktop'))
    from echo_desktop.storage import Settings
    settings = Settings()
    key, url = settings.secret('llm_key'), settings['llm_url']
if not key or not url:
    print('BLOCKED: Configure an approved backend provider.', flush=True)
    sys.exit(2)
clients = load_clients(source / 'echo-web' / 'clients' / 'example.json')
client = clients.pop('demo')
client['site_id'] = 'productivity-portal'
client['branding'] = {'name': 'ECHO', 'accent': '#1d4ed8', 'greeting': 'Synthetic integration smoke test.'}
client['allowed_origins'] = (sys.argv[1],)
api = ApiServer(('127.0.0.1', 0), {'productivity-portal': client}, url, key,
                os.environ.get('ECHO_MODEL', 'auto:reliable'))
print(json.dumps({'apiOrigin': f'http://127.0.0.1:{api.server_port}'}), flush=True)
try:
    api.serve_forever()
finally:
    api.server_close()
