# El bucket se pasa en `terraform init -backend-config="bucket=..."`.
terraform {
  backend "gcs" {
    prefix = "hospitaline/terraform"
  }
}
