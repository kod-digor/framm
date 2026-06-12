# Durcissement : tfstate et backups avec versioning
resource "scaleway_object_bucket" "tfstate" {
  name   = local.bucket_tfstate
  region = var.scw_region

  versioning {
    enabled = true
  }

  tags = {
    project = "framm"
    role    = "tfstate"
  }
}

resource "scaleway_object_bucket_acl" "tfstate" {
  bucket = scaleway_object_bucket.tfstate.name
  acl    = "private"
}
