#!/usr/bin/env bash

set -euo pipefail

docker compose down --volumes --remove-orphans
bash scripts/db-up.sh
