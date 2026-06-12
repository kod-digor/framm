terraform {
  required_version = ">= 1.5.0"
  required_providers {
    scaleway = { source = "scaleway/scaleway", version = "~> 2.57" }
    random   = { source = "hashicorp/random", version = "~> 3.6" }
    local    = { source = "hashicorp/local", version = "~> 2.5" }
  }
}
