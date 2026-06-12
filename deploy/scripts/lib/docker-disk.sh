#!/usr/bin/env bash
# Préparation disque Docker sur les VMs — sourcer, ne pas exécuter directement

FRAMM_DOCKER_DATA_DIR="${FRAMM_DOCKER_DATA_DIR:-/var/lib/docker}"
FRAMM_DOCKER_MIN_FREE_MB="${FRAMM_DOCKER_MIN_FREE_MB:-2048}"

framm_docker_block_device() {
  local id dev
  for id in /dev/disk/by-id/scsi-0SCW_sbs_volume-*; do
    [[ -e "$id" ]] || continue
    dev="$(readlink -f "$id")"
    [[ "$dev" =~ /sda ]] && continue
    if [[ -b "$dev" ]] && ! lsblk -n -o MOUNTPOINT "$dev" 2>/dev/null | grep -q .; then
      echo "$dev"
      return 0
    fi
  done

  lsblk -dpno NAME,MOUNTPOINT | awk '
    $1 ~ /^\/dev\/(sd[b-z]|vd[b-z])$/ && $2 == "" { print $1; exit }
  '
}

framm_docker_on_dedicated_volume() {
  if ! mountpoint -q "$FRAMM_DOCKER_DATA_DIR" 2>/dev/null; then
    return 1
  fi
  local src
  src="$(findmnt -n -o SOURCE --target "$FRAMM_DOCKER_DATA_DIR")"
  [[ "$src" =~ (^/dev/(sd[b-z]|vd[b-z])|SCW|UUID=) ]]
}

framm_mount_docker_data_disk() {
  if framm_docker_on_dedicated_volume; then
    echo "Docker data déjà sur volume dédié ($(findmnt -n -o SOURCE --target "$FRAMM_DOCKER_DATA_DIR"))"
    return 0
  fi

  local dev
  dev="$(framm_docker_block_device || true)"
  if [[ -z "$dev" ]]; then
    echo "Aucun volume bloc disponible — Docker reste sur le disque root"
    return 0
  fi

  echo "Montage volume Docker: ${dev} → ${FRAMM_DOCKER_DATA_DIR}"

  if ! blkid -o value -s TYPE "$dev" 2>/dev/null | grep -q .; then
    mkfs.ext4 -F -L framm-docker "$dev"
  fi

  systemctl stop docker 2>/dev/null || true

  if [[ -d "$FRAMM_DOCKER_DATA_DIR" ]] && [[ -n "$(ls -A "$FRAMM_DOCKER_DATA_DIR" 2>/dev/null)" ]]; then
    local migrate_dir=/mnt/framm-docker-migrate
    mkdir -p "$migrate_dir"
    mount "$dev" "$migrate_dir"
    echo "Migration données Docker vers le volume dédié..."
    rsync -aHAX "$FRAMM_DOCKER_DATA_DIR/" "$migrate_dir/"
    umount "$migrate_dir"
    rm -rf "${FRAMM_DOCKER_DATA_DIR:?}"/*
  fi

  mkdir -p "$FRAMM_DOCKER_DATA_DIR"
  if ! mountpoint -q "$FRAMM_DOCKER_DATA_DIR"; then
    mount "$dev" "$FRAMM_DOCKER_DATA_DIR"
  fi

  local uuid
  uuid="$(blkid -s UUID -o value "$dev")"
  if [[ -n "$uuid" ]] && ! grep -q "$uuid" /etc/fstab 2>/dev/null; then
    echo "UUID=${uuid} ${FRAMM_DOCKER_DATA_DIR} ext4 defaults,nofail 0 2" >> /etc/fstab
  fi

  systemctl start docker
  echo "Volume Docker prêt ($(df -hP "$FRAMM_DOCKER_DATA_DIR" | awk 'NR==2{print $4}') libre)"
}

framm_docker_free_mb() {
  df -Pm "$FRAMM_DOCKER_DATA_DIR" 2>/dev/null | awk 'NR==2{print $4}'
}

framm_docker_require_space() {
  local min_mb="${1:-$FRAMM_DOCKER_MIN_FREE_MB}"
  local free
  free="$(framm_docker_free_mb)"
  if [[ -z "$free" || "$free" -lt "$min_mb" ]]; then
    echo "Espace disque Docker insuffisant: ${free:-0} Mo libre, ${min_mb} Mo requis"
    return 1
  fi
  echo "Espace Docker OK: ${free} Mo libre (min ${min_mb} Mo)"
}

framm_docker_prune_for_build() {
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -af >/dev/null 2>&1 || true
  docker system prune -af >/dev/null 2>&1 || true
}

framm_docker_prepare_build() {
  local compose_dir="${FRAMM_COMPOSE_DIR:-/opt/framm/deploy/docker}"

  framm_mount_docker_data_disk

  cd "$compose_dir"
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-framm}"

  echo "Nettoyage Docker pré-build..."
  docker compose -f docker-compose.observability.yml stop 2>/dev/null || true
  docker compose -f docker-compose.app.yml stop web worker 2>/dev/null || true
  framm_docker_prune_for_build

  if ! framm_docker_require_space; then
    echo "Espace toujours insuffisant — nettoyage supplémentaire..."
    framm_docker_prune_for_build
    framm_docker_require_space
  fi
}
