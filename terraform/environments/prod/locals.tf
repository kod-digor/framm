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
}
