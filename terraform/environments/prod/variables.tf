variable "scw_project_id" {
  type = string
}

variable "scw_region" {
  type    = string
  default = "fr-par"
}

variable "scw_zone" {
  type    = string
  default = "fr-par-1"
}

variable "admin_password" {
  type      = string
  sensitive = true
}

variable "admin_email" {
  type      = string
  sensitive = true
  description = "Email du compte bureau (fourni via .env, jamais en dur dans le code)"
}

variable "dns_enabled" {
  type        = bool
  default     = false
  description = "Active les records DNS Scaleway — nécessite la zone déléguée chez Scaleway"
}

variable "primary_platform_domain" {
  type    = string
  default = "kod-digor.bzh"
}

variable "app_bzh_enabled" {
  type    = bool
  default = false
}

variable "admin_ips" {
  type    = list(string)
  default = []
}

variable "ssh_public_key" {
  type        = string
  description = "Clé SSH publique injectée via cloud-init (root)"
}

variable "environment" {
  type    = string
  default = "prod"
}
