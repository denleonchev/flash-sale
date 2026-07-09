resource "google_service_account" "deployer_sa" {
  account_id   = "deployer-sa-id"
  display_name = "Deployer Service Account"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "deployer_member_iap" {
  project = var.project_id
  role    = "roles/iap.tunnelResourceAccessor"
  member  = "serviceAccount:${google_service_account.deployer_sa.email}"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "deployer_member_compute" {
  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.deployer_sa.email}"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool" "github_pool" {
  workload_identity_pool_id = "github-pool"
  display_name              = "github-pool"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == 'denleonchev/flash-sale'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.deployer_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool.name}/attribute.repository/denleonchev/flash-sale"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "vm_runtime_sa" {
  account_id   = "vm-runtime-sa"
  display_name = "VM Runtime Service Account"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "vm_runtime_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.vm_runtime_sa.email}"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "vm_runtime_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.vm_runtime_sa.email}"

  depends_on = [google_project_service.required]
}
