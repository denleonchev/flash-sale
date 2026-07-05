resource "google_compute_firewall" "ssh-firewall" {
  name    = "ssh-firewall"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["allow-iap-ssh"]

  depends_on = [google_project_service.required]
}

resource "google_compute_firewall" "http-firewall" {
  name    = "http-firewall"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["allow-http-https"]

  depends_on = [google_project_service.required]
}

resource "google_compute_address" "static-ip" {
  name   = "ext-ip"
  region = var.region

  depends_on = [google_project_service.required]
}
