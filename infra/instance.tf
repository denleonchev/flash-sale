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
    ssh-keys = "deployer:ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMN3apwN+wWwVfSZ1kgZ71+k2m00JOxoV05rtnjp3Jwg github-actions-deploy"
  }

  metadata_startup_script = file("${path.module}/scripts/startup.sh")

  depends_on = [google_project_service.required]
}
