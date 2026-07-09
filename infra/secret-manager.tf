# Holds only the .env secret's container, never its value: terraform.tfstate is committed to
# this repo, so any value Terraform manages would end up in git in plaintext. The actual
# payload is pushed directly via `gcloud secrets versions add`, bypassing state entirely.
resource "google_secret_manager_secret" "vm_env" {
  secret_id = "flash-sale-env"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "vm_env_accessor" {
  secret_id = google_secret_manager_secret.vm_env.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm_runtime_sa.email}"
}
