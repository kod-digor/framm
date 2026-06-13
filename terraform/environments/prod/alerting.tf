# Envoi des emails d'alerte via Scaleway TEM (Transactional Email).
# Provisionné automatiquement quand la zone DNS est gérée par Scaleway ;
# les variables ALERT_SMTP_* du .env restent prioritaires si définies
# (par exemple pour utiliser un SMTP hors Scaleway).

resource "scaleway_tem_domain" "alerts" {
  count      = var.dns_enabled && var.tem_enabled ? 1 : 0
  name       = var.primary_platform_domain
  accept_tos = true
  region     = var.scw_region
  project_id = var.scw_project_id
}

# SPF combiné : la VM mail (Stalwart) ET TEM doivent être autorisés à émettre
# pour le domaine, sinon l'un des deux part en spam.
resource "scaleway_domain_record" "tem_spf" {
  count    = var.dns_enabled && var.tem_enabled ? 1 : 0
  dns_zone = var.primary_platform_domain
  name     = ""
  type     = "TXT"
  data     = "v=spf1 ip4:${module.mail_vm.public_ip} ${scaleway_tem_domain.alerts[0].spf_config} ~all"
}

resource "scaleway_domain_record" "tem_dkim" {
  count    = var.dns_enabled && var.tem_enabled ? 1 : 0
  dns_zone = var.primary_platform_domain
  name     = scaleway_tem_domain.alerts[0].dkim_name
  type     = "TXT"
  data     = scaleway_tem_domain.alerts[0].dkim_config
}

resource "scaleway_domain_record" "tem_dmarc" {
  count    = var.dns_enabled && var.tem_enabled ? 1 : 0
  dns_zone = var.primary_platform_domain
  name     = scaleway_tem_domain.alerts[0].dmarc_name
  type     = "TXT"
  data     = scaleway_tem_domain.alerts[0].dmarc_config
}

# Attend que Scaleway valide les records (jusqu'à 15 min de propagation DNS).
# En cas d'échec, relancer bin/framm bootstrap une fois le DNS propagé.
resource "scaleway_tem_domain_validation" "alerts" {
  count     = var.dns_enabled && var.tem_enabled ? 1 : 0
  domain_id = scaleway_tem_domain.alerts[0].id
  region    = var.scw_region
  timeout   = 900

  depends_on = [
    scaleway_domain_record.tem_spf,
    scaleway_domain_record.tem_dkim,
    scaleway_domain_record.tem_dmarc,
  ]
}

resource "scaleway_iam_application" "alerts" {
  count       = var.dns_enabled && var.tem_enabled ? 1 : 0
  name        = "framm-alerts"
  description = "Authentification SMTP TEM pour les alertes Alertmanager"
}

resource "scaleway_iam_policy" "alerts" {
  count          = var.dns_enabled && var.tem_enabled ? 1 : 0
  name           = "framm-alerts-policy"
  application_id = scaleway_iam_application.alerts[0].id

  rule {
    project_ids          = [var.scw_project_id]
    permission_set_names = ["TransactionalEmailFullAccess"]
  }
}

resource "scaleway_iam_api_key" "alerts" {
  count              = var.dns_enabled && var.tem_enabled ? 1 : 0
  application_id     = scaleway_iam_application.alerts[0].id
  default_project_id = var.scw_project_id
}
