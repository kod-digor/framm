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
"${ROOT}/deploy/scripts/k8s-sync-secrets.sh"

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
