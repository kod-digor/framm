variable "zone_name" {
  type = string
}

variable "records" {
  type = list(object({
    name  = string
    type  = string
    data  = string
    ttl   = optional(number, 3600)
  }))
  default = []
}
