#!/usr/bin/env bash

set -euo pipefail

docker compose up --detach --wait --wait-timeout 60 --remove-orphans postgresql
