locals {
  project_slug = replace(var.scw_project_id, "-", "")

  platform_domains = compact([
    var.primary_platform_domain,
    var.app_bzh_enabled ? "app.bzh" : "",
  ])

  auth_url    = "https://${var.primary_platform_domain}"
  webmail_url = "https://webmail.${var.primary_platform_domain}"
  mail_url    = "https://webmail.${var.primary_platform_domain}"
  grafana_url = "https://grafana.${var.primary_platform_domain}"

  bucket_uploads  = "framm-uploads-${local.project_slug}"
  bucket_backups  = "framm-backups-${local.project_slug}"
  bucket_cold     = "framm-cold-${local.project_slug}"
  bucket_tfstate  = "framm-tfstate-${local.project_slug}"

  # SMTP d'alerte : override manuel (.env) prioritaire, sinon TEM Scaleway
  # provisionné par alerting.tf quand le DNS est géré ici.
  alert_smtp_host     = var.alert_smtp_host != "" ? var.alert_smtp_host : (var.dns_enabled ? scaleway_tem_domain.alerts[0].smtp_host : "")
  alert_smtp_port     = var.alert_smtp_host != "" ? var.alert_smtp_port : "587"
  alert_smtp_user     = var.alert_smtp_host != "" ? var.alert_smtp_user : (var.dns_enabled ? scaleway_tem_domain.alerts[0].smtps_auth_user : "")
  alert_smtp_password = var.alert_smtp_host != "" ? var.alert_smtp_password : (var.dns_enabled ? scaleway_iam_api_key.alerts[0].secret_key : "")
  alert_smtp_from     = var.alert_smtp_from != "" ? var.alert_smtp_from : "alertes@${var.primary_platform_domain}"
}
