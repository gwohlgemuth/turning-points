#!/bin/sh
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOMEPAGE="${HOMEPAGE:-$ROOT/../homepage}"

if ! git -C "$HOMEPAGE" rev-parse --git-dir >/dev/null 2>&1; then
	echo "Homepage repo not found at $HOMEPAGE (set HOMEPAGE to its path)" >&2
	exit 1
fi

cd "$ROOT"
if [ -n "$(git status --porcelain)" ]; then
	echo "turning-points has uncommitted changes; commit them first" >&2
	exit 1
fi
HASH=$(git rev-parse --short HEAD)

pnpm build:static
rm -rf "$HOMEPAGE/turning-points"
cp -r build "$HOMEPAGE/turning-points"

if [ -z "$(git -C "$HOMEPAGE" status --porcelain -- turning-points)" ]; then
	echo "Turning Points is already up to date on the homepage"
	exit 0
fi

git -C "$HOMEPAGE" add -A turning-points
git -C "$HOMEPAGE" commit -q -m "Update Turning Points to $HASH" -- turning-points
echo "Committed Turning Points $HASH in $HOMEPAGE; push it there to deploy"
