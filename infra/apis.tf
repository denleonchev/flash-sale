locals {
  required_apis = [
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sts.googleapis.com",
    "iap.googleapis.com",
  ]
}

# disable_on_destroy = false: the project is created by hand, so `terraform destroy`
# should not turn off APIs the project owner may rely on outside this config.
resource "google_project_service" "required" {
  for_each = toset(local.required_apis)

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}
