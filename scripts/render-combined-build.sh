#!/usr/bin/env bash
set -euo pipefail

npm install
npm run build:backend
python -m pip install -r ai-service/requirements.txt
