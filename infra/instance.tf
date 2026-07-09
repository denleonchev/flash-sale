resource "google_compute_instance" "default" {
  name         = "vm"
  machine_type = "e2-small"
  zone         = var.zone

  tags = ["allow-iap-ssh", "allow-http-https"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.static-ip.address
    }
  }

  metadata = {
    ssh-keys         = "deployer:${var.deployer_ssh_public_key}"
    ops-agent-config = file("${path.module}/ops-agent/config.yaml")
  }

  metadata_startup_script = file("${path.module}/scripts/startup.sh")

  service_account {
    email  = google_service_account.vm_runtime_sa.email
    scopes = ["cloud-platform"]
  }

  depends_on = [google_project_service.required]
}
