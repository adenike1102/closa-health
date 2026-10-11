#!/usr/bin/env bash
# Run on the server as the "closa" user, from /opt/closa:   ./deploy/deploy.sh
set -euo pipefail
git pull --ff-only
( cd backend && python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt && .venv/bin/pytest -q )
( cd frontend && npm ci && npm test && npm run build )
sudo rsync -a --delete frontend/dist/ /var/www/closa/
sudo systemctl restart closa-api
echo "Deployed."
