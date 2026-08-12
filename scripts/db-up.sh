#!/usr/bin/env bash

set -euo pipefail

docker compose up --detach mongodb
docker compose run --rm -T --no-deps mongodb-init
docker compose up --detach --wait --wait-timeout 60 mongodb
