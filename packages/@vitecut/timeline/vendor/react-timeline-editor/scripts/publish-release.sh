#!/bin/bash

set e

echo "🔔 Publish release version"

yarn version check --interactive

echo "==== Start Update Version ===="

BEFORE_VERSION=$(cat packages/timeline/package.json | grep version | cut -d '"' -f 4)

yarn version apply --all --json

AFTER_VERSION=$(cat packages/timeline/package.json | grep version | cut -d '"' -f 4)

echo "==== Version Change Completed, before: $BEFORE_VERSION, after: $AFTER_VERSION ===="

yarn 

yarn build

yarn workspaces foreach -ptvA --no-private \
  npm publish --tolerate-republish --access public

echo "==== ✅ Publish alpha version completed, version: $AFTER_VERSION ===="
