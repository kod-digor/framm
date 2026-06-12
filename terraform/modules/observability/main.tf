# Module observability — génère les configs pour déploiement sur VM App
# Les fichiers sources vivent dans deploy/observability/

output "compose_file" {
  value = "${path.module}/../../deploy/docker/docker-compose.observability.yml"
}

output "grafana_url_pattern" {
  value = "https://grafana.${var.primary_domain}"
}

variable "primary_domain" {
  type = string
}

variable "alert_email" {
  type        = string
  description = "Email alertes — fourni via .env"
}
