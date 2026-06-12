variable "bucket_name" {
  type = string
}

variable "scaleway_region" {
  type    = string
  default = "fr-par"
}

variable "scaleway_project_id" {
  type = string
}

variable "project_name" {
  type    = string
  default = "framm"
}

variable "iam_application_name" {
  type    = string
  default = ""
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "versioning_enabled" {
  type    = bool
  default = true
}

variable "lifecycle_rules" {
  type = list(object({
    id              = string
    prefix          = string
    enabled         = bool
    transitions     = list(object({ days = number, storage_class = string }))
    expiration_days = optional(number)
  }))
  default = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
