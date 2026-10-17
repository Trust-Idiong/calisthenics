#!/usr/bin/env bash
set -o errexit
set -o nounset
python -m pip install -r backend/requirements.txt
python backend/manage.py collectstatic --no-input
python backend/manage.py check --deploy --fail-level WARNING
