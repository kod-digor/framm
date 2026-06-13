#!/usr/bin/env bash
# Bootstrap du cluster Kapsule : ArgoCD, secrets applicatifs, issuer TLS,
# monitoring, puis app-of-apps. Idempotent — relançable sans risque.
# Prérequis : bin/framm bootstrap (Terraform) exécuté, kubectl installé.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GEN_DIR="${ROOT}/deploy/.generated"
ENV_FILE="${GEN_DIR}/env.production"
export KUBECONFIG="${GEN_DIR}/kubeconfig"

[[ -f "$ENV_FILE" ]] || { echo "env.production manquant — lancez bin/framm bootstrap d'abord"; exit 1; }
[[ -f "$KUBECONFIG" ]] || { echo "kubeconfig manquant — lancez bin/framm bootstrap (Terraform) d'abord"; exit 1; }
command -v kubectl >/dev/null || { echo "kubectl requis"; exit 1; }

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

render() {
  sed \
    -e "s|__ADMIN_EMAIL__|${BUREAU_ADMIN_EMAIL}|g" \
    -e "s|__ALERT_EMAIL__|${ALERT_EMAIL:-${BUREAU_ADMIN_EMAIL}}|g" \
    -e "s|__ALERT_SMTP_HOST__|${ALERT_SMTP_HOST:-}|g" \
    -e "s|__ALERT_SMTP_PORT__|${ALERT_SMTP_PORT:-587}|g" \
    -e "s|__ALERT_SMTP_USER__|${ALERT_SMTP_USER:-}|g" \
    -e "s|__ALERT_SMTP_FROM__|${ALERT_SMTP_FROM:-alertes@${PRIMARY_PLATFORM_DOMAIN}}|g" \
    -e "s|__PRIMARY_DOMAIN__|${PRIMARY_PLATFORM_DOMAIN}|g" \
    "$1"
}

echo "=== Installation ArgoCD ==="
# Server-side apply évite l'annotation last-applied-configuration trop volumineuse
# sur le CRD applicationsets (limite Kubernetes 256 KiB).
kubectl apply --server-side --force-conflicts -k "${ROOT}/k8s/bootstrap/argocd" || true
kubectl apply --server-side --force-conflicts -k "${ROOT}/k8s/bootstrap/argocd"
kubectl -n argocd rollout status deployment/argocd-server --timeout=300s

# Accès au dépôt si privé (inutile si le dépôt est public)
if [[ -n "${FRAMM_GIT_TOKEN:-}" ]]; then
  kubectl -n argocd create secret generic framm-repo \
    --from-literal=type=git \
    --from-literal=url=https://github.com/kod-digor/framm \
    --from-literal=username=x-access-token \
    --from-literal=password="${FRAMM_GIT_TOKEN}" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n argocd label secret framm-repo argocd.argoproj.io/secret-type=repository --overwrite
fi

echo "=== Secrets applicatifs ==="
kubectl create namespace framm --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# DATABASE_URL pointe vers la base managée (réseau privé), pas le postgres VM
kubectl -n framm create secret generic framm-env \
  --from-literal=DATABASE_URL="${K8S_DATABASE_URL}" \
  --from-literal=AUTH_SECRET="${AUTH_SECRET}" \
  --from-literal=AUTH_URL="${AUTH_URL}" \
  --from-literal=AUTH_TRUST_HOST="true" \
  --from-literal=PLATFORM_DOMAINS="${PLATFORM_DOMAINS}" \
  --from-literal=WEBMAIL_URL="${WEBMAIL_URL}" \
  --from-literal=STALWART_URL="${STALWART_URL}" \
  --from-literal=STALWART_API_KEY="${STALWART_API_KEY}" \
  --from-literal=PRIMARY_PLATFORM_DOMAIN="${PRIMARY_PLATFORM_DOMAIN}" \
  --from-literal=BUREAU_ADMIN_EMAIL="${BUREAU_ADMIN_EMAIL}" \
  --from-literal=BUREAU_ADMIN_PASSWORD="${BUREAU_ADMIN_PASSWORD}" \
  --from-literal=BUREAU_ORG_NAME="${BUREAU_ORG_NAME:-Kod Digor}" \
  --from-literal=BUREAU_ORG_SLUG="${BUREAU_ORG_SLUG:-kod-digor}" \
  --from-literal=S3_ENDPOINT="${S3_ENDPOINT}" \
  --from-literal=S3_REGION="${S3_REGION}" \
  --from-literal=S3_BUCKET_UPLOADS="${S3_BUCKET_UPLOADS}" \
  --from-literal=S3_BUCKET_BACKUPS="${S3_BUCKET_BACKUPS}" \
  --from-literal=S3_ACCESS_KEY="${S3_ACCESS_KEY}" \
  --from-literal=S3_SECRET_KEY="${S3_SECRET_KEY}" \
  --from-literal=OUTBOUND_SMTP_RELAY_HOST="${OUTBOUND_SMTP_RELAY_HOST:-}" \
  --from-literal=OUTBOUND_SMTP_RELAY_PORT="${OUTBOUND_SMTP_RELAY_PORT:-2587}" \
  --from-literal=OUTBOUND_SMTP_RELAY_USER="${OUTBOUND_SMTP_RELAY_USER:-}" \
  --from-literal=OUTBOUND_SMTP_RELAY_SECRET="${OUTBOUND_SMTP_RELAY_SECRET:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n monitoring create secret generic framm-grafana \
  --from-literal=admin-user=admin \
  --from-literal=admin-password="${GRAFANA_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n monitoring create secret generic framm-alert-smtp \
  --from-literal=password="${ALERT_SMTP_PASSWORD:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "=== Issuer TLS + monitoring + app-of-apps ==="
kubectl apply -f "${ROOT}/k8s/bootstrap/root-app.yaml"

if [[ -n "${ALERT_SMTP_HOST:-}" ]]; then
  render "${ROOT}/k8s/templates/monitoring-app.tpl.yaml" | kubectl apply -f -
else
  echo "AVERTISSEMENT : ALERT_SMTP_HOST absent — monitoring déployé sans envoi d'emails" >&2
fi

# Le ClusterIssuer dépend des CRDs cert-manager (installés par ArgoCD) :
# on réessaie le temps que la sync passe.
for i in $(seq 1 30); do
  if render "${ROOT}/k8s/templates/cluster-issuer.tpl.yaml" | kubectl apply -f - 2>/dev/null; then
    echo "ClusterIssuer letsencrypt appliqué"
    break
  fi
  [[ "$i" == 30 ]] && echo "AVERTISSEMENT : CRDs cert-manager pas encore prêts — relancez ce script" >&2
  sleep 10
done

echo "Bootstrap Kubernetes terminé."
echo "Mot de passe initial ArgoCD :"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
echo "Interface : kubectl -n argocd port-forward svc/argocd-server 8083:443 → https://localhost:8083"
