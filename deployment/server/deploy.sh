#!/bin/sh
set -eu

release="${1:-}"
sha=${release#sha-}
case "$sha" in
  *[!0-9a-f]* | "")
    echo "Invalid release tag" >&2
    exit 64
    ;;
  [0-9a-f]*) ;;
  *)
    echo "Invalid release tag" >&2
    exit 64
    ;;
esac

if [ "${#release}" -ne 44 ]; then
  echo "Release tag must contain a full 40-character commit SHA" >&2
  exit 64
fi

deployment_dir=/opt/shortlistos
compose_file="$deployment_dir/compose.yml"
lock_file=/run/lock/shortlistos-deploy.lock

if [ ! -f "$compose_file" ] || [ ! -f "$deployment_dir/.env" ]; then
  echo "Production Compose configuration is not installed" >&2
  exit 78
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another shortlistOS deployment is already running" >&2
  exit 75
fi

cd "$deployment_dir"
export APP_VERSION="$release"

previous_release=""
if [ -f .deployed-release ]; then
  previous_release=$(sed -n '1p' .deployed-release)
fi

echo "Pulling shortlistOS release $release"
docker compose --env-file .env -f "$compose_file" pull

echo "Running database migrations"
docker compose --env-file .env -f "$compose_file" run --rm migrate

echo "Starting application services"
docker compose --env-file .env -f "$compose_file" up -d --remove-orphans --wait \
  postgres redis web web-clipper-api queue-worker enrichment-worker \
  card-worker email-worker

printf '%s\n' "$release" > .deployed-release
echo "Release $release is healthy"

echo "Removing shortlistOS images older than the previous healthy release"
current_images=$(docker compose --env-file .env -f "$compose_file" config --images)
for current_image in $(printf '%s\n' "$current_images" | grep ":$release$" | sort -u); do
  repository=${current_image%:*}

  for image in $(docker image ls "$repository" --format '{{.Repository}}:{{.Tag}}'); do
    tag=${image##*:}
    image_sha=${tag#sha-}

    # Only manage full-SHA release tags created by this deployment pipeline.
    if [ "$image_sha" = "$tag" ] || [ "${#image_sha}" -ne 40 ]; then
      continue
    fi
    case "$image_sha" in
      *[!0-9a-f]*) continue ;;
    esac

    if [ "$tag" = "$release" ] || [ "$tag" = "$previous_release" ]; then
      continue
    fi

    if ! docker image rm "$image"; then
      echo "Keeping $image because Docker reports that it is still in use" >&2
    fi
  done
done
