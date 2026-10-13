resource "google_compute_network" "main" {
  name                    = "${var.name}-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

# Cloud Run sale por este conector para llegar a la IP privada de Memorystore.
resource "google_vpc_access_connector" "main" {
  name          = "${var.name}-conn"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
  machine_type  = "e2-micro"
  min_instances = 2
  max_instances = 3
}
