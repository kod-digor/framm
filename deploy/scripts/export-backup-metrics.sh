#!/usr/bin/env bash
# Exporte métriques backup pour Prometheus textfile collector
DIR="/var/lib/node_exporter/textfile_collector"
mkdir -p "$DIR"
echo "framm_backup_last_run $(date +%s)" > "${DIR}/framm_backup.prom.$$"
mv "${DIR}/framm_backup.prom.$$" "${DIR}/framm_backup.prom"
