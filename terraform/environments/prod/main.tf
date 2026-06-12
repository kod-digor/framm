module "uploads" {
  source = "../../modules/object_storage"

  bucket_name         = local.bucket_uploads
  scaleway_project_id = var.scw_project_id
  scaleway_region     = var.scw_region
  iam_application_name = "framm-uploads"
}

module "backups" {
  source = "../../modules/object_storage"

  bucket_name         = local.bucket_backups
  scaleway_project_id = var.scw_project_id
  scaleway_region     = var.scw_region
  iam_application_name = "framm-backups"

  # 30 backups quotidiens conservés (le versioning du bucket protège en plus
  # contre l'écrasement ou la suppression accidentelle).
  lifecycle_rules = [{
    id              = "expire-old-backups"
    prefix          = ""
    enabled         = true
    transitions     = []
    expiration_days = 30
  }]
}

module "cold_archive" {
  source = "../../modules/object_storage"

  bucket_name         = local.bucket_cold
  scaleway_project_id = var.scw_project_id
  scaleway_region     = var.scw_region
  iam_application_name = "framm-cold"

  lifecycle_rules = [{
    id      = "to-glacier"
    prefix  = ""
    enabled = true
    transitions = [{
      days          = 90
      storage_class = "GLACIER"
    }]
    expiration_days = 365
  }]
}

module "app_vm" {
  source = "../../modules/compute_instance"

  name           = "framm-app-${var.environment}"
  instance_type  = var.environment == "prod" ? var.app_instance_type : "DEV1-M"
  volume_size_gb = 20
  zone           = var.scw_zone
  inbound_ports  = [22, 80, 443]
  admin_ips      = var.admin_ips

  cloud_init = templatefile("${path.module}/../../../deploy/cloud-init/app.yaml", {
    domain         = var.primary_platform_domain
    ssh_public_key = var.ssh_public_key
  })
}

module "mail_vm" {
  source = "../../modules/compute_instance"

  name           = "framm-mail-${var.environment}"
  instance_type  = var.environment == "prod" ? var.mail_instance_type : "DEV1-M"
  volume_size_gb = 50
  zone           = var.scw_zone
  inbound_ports  = [22, 25, 80, 443, 465, 587, 993]
  admin_ips      = var.admin_ips

  # node-exporter scrapé par le Prometheus de la VM App uniquement
  restricted_inbound_rules = [{
    port     = 9100
    ip_range = "${module.app_vm.public_ip}/32"
  }]

  cloud_init = templatefile("${path.module}/../../../deploy/cloud-init/mail.yaml", {
    domain         = var.primary_platform_domain
    ssh_public_key = var.ssh_public_key
  })
}

module "dns_kod_digor" {
  count  = var.dns_enabled ? 1 : 0
  source = "../../modules/dns_records"

  zone_name = var.primary_platform_domain
  records = [
    { name = "", type = "A", data = local.app_ingress_ip },
    { name = "www", type = "A", data = local.app_ingress_ip },
    { name = "staging", type = "A", data = local.app_ingress_ip },
    { name = "grafana", type = "A", data = local.app_ingress_ip },
    { name = "mail", type = "A", data = module.mail_vm.public_ip },
    { name = "webmail", type = "A", data = module.mail_vm.public_ip },
    { name = "", type = "MX", data = "10 mail.${var.primary_platform_domain}." },
  ]
}

module "dns_app_bzh" {
  count  = var.app_bzh_enabled && var.dns_enabled ? 1 : 0
  source = "../../modules/dns_records"

  zone_name = "app.bzh"
  records = [
    { name = "", type = "A", data = module.app_vm.public_ip },
    { name = "www", type = "A", data = module.app_vm.public_ip },
    { name = "mail", type = "A", data = module.mail_vm.public_ip },
    { name = "webmail", type = "A", data = module.mail_vm.public_ip },
    { name = "", type = "MX", data = "10 mail.app.bzh." },
  ]
}

resource "local_file" "env_production" {
  filename = "${path.module}/../../../deploy/.generated/env.production"
  content = templatefile("${path.module}/templates/env.production.tpl", {
    auth_secret          = random_password.auth_secret.result
    auth_url             = local.auth_url
    platform_domains     = join(",", local.platform_domains)
    webmail_url          = local.webmail_url
    stalwart_url         = local.mail_url
    stalwart_api_key     = random_password.stalwart_api_key.result
    db_password          = random_password.db_password.result
    db_host              = "127.0.0.1"
    k8s_database_url     = local.k8s_database_url
    grafana_password     = random_password.grafana_password.result
    grafana_root_url     = local.grafana_url
    alert_email          = var.admin_email
    alert_smtp_host      = local.alert_smtp_host
    alert_smtp_port      = local.alert_smtp_port
    alert_smtp_user      = local.alert_smtp_user
    alert_smtp_password  = local.alert_smtp_password
    alert_smtp_from      = local.alert_smtp_from
    bureau_admin_email   = var.admin_email
    bureau_admin_password = var.admin_password
    primary_domain       = var.primary_platform_domain
    s3_endpoint          = module.uploads.s3_endpoint
    s3_region            = module.uploads.s3_region
    s3_bucket_uploads    = module.uploads.bucket_name
    s3_bucket_backups    = module.backups.bucket_name
    s3_access_key        = module.uploads.access_key
    s3_secret_key        = module.uploads.secret_key
    app_public_ip        = module.app_vm.public_ip
    mail_public_ip       = module.mail_vm.public_ip
  })

  depends_on = [module.uploads, module.app_vm, module.mail_vm]
}
