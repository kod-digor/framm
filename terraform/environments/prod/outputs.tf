output "app_public_ip" {
  value = local.app_ingress_ip
  description = "IP d'entrée app (LB Traefik Kapsule)"
}

output "mail_public_ip" {
  value = module.mail_vm.public_ip
}

output "auth_url" {
  value = local.auth_url
}

output "uploads_bucket" {
  value = module.uploads.bucket_name
}

output "env_file" {
  value     = local_file.env_production.filename
  sensitive = false
}

output "dns_enabled" {
  value = var.dns_enabled
}

output "k8s_cluster_id" {
  value = scaleway_k8s_cluster.framm.id
}

output "kubeconfig_path" {
  value = local_sensitive_file.kubeconfig.filename
}

output "registry_endpoint" {
  value = scaleway_registry_namespace.framm.endpoint
}

output "rdb_private_ip" {
  value = scaleway_rdb_instance.main.private_network[0].ip
}

output "manual_dns_records" {
  description = "Records à configurer manuellement si dns_enabled=false"
  value = var.dns_enabled ? null : {
    domain = var.primary_platform_domain
    records = {
      "@"       = local.app_ingress_ip
      "www"     = local.app_ingress_ip
      "mail"    = module.mail_vm.public_ip
      "webmail" = module.mail_vm.public_ip
      "MX"      = "10 mail.${var.primary_platform_domain}."
    }
  }
}
