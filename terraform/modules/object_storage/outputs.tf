output "bucket_name" {
  value = scaleway_object_bucket.this.name
}

output "s3_endpoint" {
  value = "https://s3.${var.scaleway_region}.scw.cloud"
}

output "s3_region" {
  value = var.scaleway_region
}

output "access_key" {
  value     = scaleway_iam_api_key.this.access_key
  sensitive = true
}

output "secret_key" {
  value     = scaleway_iam_api_key.this.secret_key
  sensitive = true
}
