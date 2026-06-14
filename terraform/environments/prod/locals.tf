locals {
  project_slug = replace(var.scw_project_id, "-", "")

  platform_domains = compact([
    var.primary_platform_domain,
    var.app_bzh_enabled ? "app.bzh" : "",
  ])

  auth_url    = "https://${var.primary_platform_domain}"
  webmail_url = "https://webmail.${var.primary_platform_domain}"
  mail_url    = "https://mail.${var.primary_platform_domain}"
  grafana_url = "https://grafana.${var.primary_platform_domain}"

  bucket_uploads  = "framm-uploads-${local.project_slug}"
  bucket_backups  = "framm-backups-${local.project_slug}"
  bucket_cold     = "framm-cold-${local.project_slug}"
  bucket_tfstate  = "framm-tfstate-${local.project_slug}"

  # SMTP d'alerte : override manuel (.env) prioritaire, sinon TEM Scaleway
  # provisionné par alerting.tf quand le DNS est géré ici.
  alert_smtp_host     = var.alert_smtp_host != "" ? var.alert_smtp_host : (var.dns_enabled && var.tem_enabled ? scaleway_tem_domain.alerts[0].smtp_host : "")
  alert_smtp_port     = var.alert_smtp_host != "" ? var.alert_smtp_port : "587"
  alert_smtp_user     = var.alert_smtp_host != "" ? var.alert_smtp_user : (var.dns_enabled && var.tem_enabled ? scaleway_tem_domain.alerts[0].smtps_auth_user : "")
  alert_smtp_password = var.alert_smtp_host != "" ? var.alert_smtp_password : (var.dns_enabled && var.tem_enabled ? scaleway_iam_api_key.alerts[0].secret_key : "")
  alert_smtp_from     = var.alert_smtp_from != "" ? var.alert_smtp_from : "alertes@${var.primary_platform_domain}"

  # Relais SMTP sortant (pods K8s + VM mail) : Scaleway bloque SMTP sortant 25/465/587
  # sur les instances — règles anti-spam non modifiables via security group Terraform.
  # Déblocage éventuel : ticket support Scaleway uniquement. Relais TEM :2587 reste la voie normale.
  outbound_smtp_relay_host   = var.dns_enabled && var.tem_enabled ? "smtp.tem.scaleway.com" : ""
  outbound_smtp_relay_port   = "2587"
  outbound_smtp_relay_user   = var.dns_enabled && var.tem_enabled ? var.scw_project_id : ""
  outbound_smtp_relay_secret = var.dns_enabled && var.tem_enabled ? scaleway_iam_api_key.alerts[0].secret_key : ""

  # Bascule DNS : k8s_lb_ip pointe l'app vers le load balancer Traefik (Kapsule).
  app_ingress_ip = var.k8s_lb_ip

  # URL de connexion pour l'app sur Kapsule (RDB via réseau privé)
  k8s_database_url = "postgresql://framm:${urlencode(random_password.rdb_password.result)}@${scaleway_rdb_instance.main.private_network[0].ip}:${scaleway_rdb_instance.main.private_network[0].port}/framm?sslmode=require&connection_limit=5&pool_timeout=20"

  rdb_host = scaleway_rdb_instance.main.private_network[0].ip
  rdb_port = scaleway_rdb_instance.main.private_network[0].port

  rdb_acl_ips = length(var.rdb_allowed_ips) > 0 ? var.rdb_allowed_ips : [for ip in var.admin_ips : "${ip}/32"]

  rdb_lb_endpoint = try(scaleway_rdb_instance.main.load_balancer[0], null)
  rdb_public_host = local.rdb_lb_endpoint != null ? coalesce(
    try(nullif(local.rdb_lb_endpoint.hostname, ""), null),
    try(local.rdb_lb_endpoint.ip, null),
    ""
  ) : ""
  rdb_public_port = (
    local.rdb_lb_endpoint != null && try(local.rdb_lb_endpoint.port, null) != null
  ) ? local.rdb_lb_endpoint.port : 5432

  # Dev local direct (Neon-style) — TLS obligatoire, IP filtrée via ACL
  dev_database_url = length(local.rdb_public_host) > 0 ? "postgresql://framm:${urlencode(random_password.rdb_password.result)}@${local.rdb_public_host}:${local.rdb_public_port}/framm?sslmode=require" : ""
}
