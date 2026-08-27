#!/bin/sh
set -eu

case "${SSH_ORIGINAL_COMMAND:-}" in
  "deploy sha-"[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
    release=${SSH_ORIGINAL_COMMAND#deploy }
    ;;
  *)
    echo "This key may only deploy a shortlistOS release" >&2
    exit 64
    ;;
esac

if [ "${#release}" -ne 44 ]; then
  echo "Invalid shortlistOS release" >&2
  exit 64
fi

sha=${release#sha-}
case "$sha" in
  *[!0-9a-f]* | "")
    echo "Invalid shortlistOS release" >&2
    exit 64
    ;;
esac

exec /usr/local/sbin/shortlistos-deploy "$release"
