#!/usr/bin/env bash

set -euo pipefail

mongodb_direct_uri='mongodb://mongodb:27017/admin?directConnection=true'

wait_for_mongodb() {
  local success_expression="$1"
  local timeout_message="$2"

  for _attempt in {1..60}; do
    if mongosh "$mongodb_direct_uri" --quiet \
      --eval "$success_expression" >/dev/null 2>&1; then
      return 0
    fi

    sleep 1
  done

  echo "$timeout_message" >&2
  return 1
}

wait_for_mongodb \
  'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)' \
  'MongoDB did not accept connections within 60 seconds.'

mongosh "$mongodb_direct_uri" --quiet \
  /opt/reviewfold/initialize-replica-set.js

wait_for_mongodb \
  'quit(db.hello().isWritablePrimary ? 0 : 1)' \
  'MongoDB did not elect a writable primary within 60 seconds.'

echo 'MongoDB replica set is ready with a writable primary.'
