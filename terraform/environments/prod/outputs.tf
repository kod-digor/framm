output "app_public_ip" {
  value = module.app_vm.public_ip
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

output "manual_dns_records" {
  description = "Records à configurer manuellement si dns_enabled=false"
  value = var.dns_enabled ? null : {
    domain = var.primary_platform_domain
    records = {
      "@"         = module.app_vm.public_ip
      "www"       = module.app_vm.public_ip
      "staging"   = module.app_vm.public_ip
      "grafana"   = module.app_vm.public_ip
      "mail"      = module.mail_vm.public_ip
      "webmail"   = module.mail_vm.public_ip
      "MX"        = "10 mail.${var.primary_platform_domain}."
    }
  }
}
