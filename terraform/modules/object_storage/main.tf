locals {
  iam_application_name = var.iam_application_name != "" ? var.iam_application_name : "${var.project_name}-${var.bucket_name}"
  base_tags = merge({
    project = var.project_name
    bucket  = var.bucket_name
  }, var.tags)
}

resource "scaleway_object_bucket" "this" {
  name          = var.bucket_name
  region        = var.scaleway_region
  force_destroy = var.force_destroy

  versioning {
    enabled = var.versioning_enabled
  }

  dynamic "lifecycle_rule" {
    for_each = { for r in var.lifecycle_rules : r.id => r }
    content {
      id      = lifecycle_rule.value.id
      prefix  = lifecycle_rule.value.prefix
      enabled = lifecycle_rule.value.enabled

      dynamic "transition" {
        for_each = lifecycle_rule.value.transitions
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }

      dynamic "expiration" {
        for_each = lifecycle_rule.value.expiration_days != null ? [lifecycle_rule.value.expiration_days] : []
        content {
          days = expiration.value
        }
      }
    }
  }

  tags = local.base_tags
}

resource "scaleway_object_bucket_acl" "this" {
  bucket = scaleway_object_bucket.this.name
  acl    = "private"
}

resource "scaleway_iam_application" "this" {
  name        = local.iam_application_name
  description = "IAM pour bucket ${var.bucket_name}"
}

resource "scaleway_iam_policy" "this" {
  name           = "${local.iam_application_name}-policy"
  application_id = scaleway_iam_application.this.id

  rule {
    project_ids = [var.scaleway_project_id]
    permission_set_names = [
      "ObjectStorageBucketsRead",
      "ObjectStorageObjectsRead",
      "ObjectStorageObjectsWrite",
      "ObjectStorageObjectsDelete",
    ]
  }
}

resource "scaleway_iam_api_key" "this" {
  application_id     = scaleway_iam_application.this.id
  default_project_id = var.scaleway_project_id
}
