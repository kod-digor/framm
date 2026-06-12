variable "name" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "DEV1-M"
}

variable "image_id" {
  type    = string
  default = "ubuntu_noble"
}

variable "zone" {
  type    = string
  default = "fr-par-1"
}

variable "volume_size_gb" {
  type    = number
  default = 20
}

variable "inbound_ports" {
  type    = list(number)
  default = [22, 80, 443]
}

variable "admin_ips" {
  type    = list(string)
  default = []
}

variable "restricted_inbound_rules" {
  description = "Ports ouverts uniquement pour une plage IP donnée (ex: scrape Prometheus inter-VM)"
  type = list(object({
    port     = number
    ip_range = string
  }))
  default = []
}

variable "private_network_id" {
  type    = string
  default = ""
}

variable "cloud_init" {
  type    = string
  default = ""
}

variable "tags" {
  type    = list(string)
  default = []
}
