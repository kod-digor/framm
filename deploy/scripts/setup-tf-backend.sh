#!/usr/bin/env bash
# Migre le tfstate prod vers un backend S3 Scaleway (bucket versionné).
# Idempotent : ne fait rien si backend.tf existe déjà.
# Appelé automatiquement par tf-apply.sh ; suppose SCW_* chargées (.env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="${ROOT}/terraform/environments/prod"
BACKEND_FILE="${TF_DIR}/backend.tf"

[[ -n "${SCW_PROJECT_ID:-}" ]] || { echo "SCW_PROJECT_ID requis"; exit 1; }
REGION="${SCW_DEFAULT_REGION:-fr-par}"
BUCKET="framm-tfstate-$(echo "$SCW_PROJECT_ID" | tr -d '-')"

export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"

if [[ -f "$BACKEND_FILE" ]]; then
  exit 0
fi

echo "Configuration du backend S3 Terraform (${BUCKET})..."

# Création du bucket (versionné : chaque état précédent reste récupérable)
if command -v scw >/dev/null 2>&1; then
  scw object bucket get "$BUCKET" region="$REGION" >/dev/null 2>&1 \
    || scw object bucket create "$BUCKET" region="$REGION" enable-versioning=true >/dev/null \
    || echo "AVERTISSEMENT : création du bucket ${BUCKET} échouée — vérifiez qu'il existe"
elif command -v aws >/dev/null 2>&1; then
  aws s3api head-bucket --bucket "$BUCKET" --endpoint-url "https://s3.${REGION}.scw.cloud" 2>/dev/null || {
    aws s3 mb "s3://${BUCKET}" --endpoint-url "https://s3.${REGION}.scw.cloud"
    aws s3api put-bucket-versioning --bucket "$BUCKET" \
      --versioning-configuration Status=Enabled \
      --endpoint-url "https://s3.${REGION}.scw.cloud"
  }
else
  echo "AVERTISSEMENT : ni scw ni aws disponibles — créez le bucket ${BUCKET} manuellement"
fi

# La syntaxe du backend s3 a changé en Terraform 1.6 (endpoints/use_path_style)
TF_MINOR="$(terraform version | head -1 | sed -E 's/^Terraform v[0-9]+\.([0-9]+).*/\1/')"
TF_MAJOR="$(terraform version | head -1 | sed -E 's/^Terraform v([0-9]+)\..*/\1/')"

if [[ "$TF_MAJOR" -gt 1 || "$TF_MINOR" -ge 6 ]]; then
  cat > "$BACKEND_FILE" <<EOF
# Généré par setup-tf-backend.sh — ne pas commiter (voir .gitignore)
terraform {
  backend "s3" {
    bucket = "${BUCKET}"
    key    = "prod/terraform.tfstate"
    region = "${REGION}"
    endpoints = {
      s3 = "https://s3.${REGION}.scw.cloud"
    }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
EOF
else
  cat > "$BACKEND_FILE" <<EOF
# Généré par setup-tf-backend.sh — ne pas commiter (voir .gitignore)
terraform {
  backend "s3" {
    bucket                      = "${BUCKET}"
    key                         = "prod/terraform.tfstate"
    region                      = "${REGION}"
    endpoint                    = "https://s3.${REGION}.scw.cloud"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}
EOF
fi

cd "$TF_DIR"
if [[ -f terraform.tfstate ]]; then
  # État local existant → migration vers le bucket
  terraform init -input=false -migrate-state -force-copy
  echo "tfstate migré vers s3://${BUCKET}/prod/terraform.tfstate"
else
  terraform init -input=false -reconfigure
  echo "Backend S3 initialisé : s3://${BUCKET}/prod/terraform.tfstate"
fi
