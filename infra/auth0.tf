resource "auth0_client" "web_app" {
  name     = "flash-sale-web-${var.environment}"
  app_type = "regular_web"

  callbacks = [
    "https://${local.app_domain}/auth/callback",
    "http://localhost:3000/auth/callback",
    "http://localhost/auth/callback"
  ]

  allowed_logout_urls = [
    "https://${local.app_domain}",
    "http://localhost:3000",
    "http://localhost"
  ]

  allowed_origins = [
    "https://${local.app_domain}",
    "http://localhost:3000",
    "http://localhost"
  ]
}

resource "auth0_client_credentials" "web_app" {
  client_id             = auth0_client.web_app.id
  authentication_method = "client_secret_post"
}

resource "auth0_client" "m2m_app" {
  name     = "flash-sale-m2m-${var.environment}"
  app_type = "non_interactive"
}
resource "auth0_client_credentials" "m2m_creds" {
  client_id             = auth0_client.m2m_app.id
  authentication_method = "client_secret_post"
}

resource "auth0_client_grant" "m2m_management_grant" {
  client_id = auth0_client.m2m_app.client_id
  audience  = "https://${var.auth0_domain}/api/v2/"
  scopes    = ["update:users", "read:roles", "create:role_members", "read:role_members", "delete:role_members"]
}

output "auth0_web_client_id" {
  value = auth0_client.web_app.client_id
}

output "auth0_web_client_secret" {
  value     = auth0_client_credentials.web_app.client_secret
  sensitive = true
}

output "auth0_m2m_client_id" {
  value = auth0_client.m2m_app.client_id
}

output "auth0_m2m_client_secret" {
  value     = auth0_client_credentials.m2m_creds.client_secret
  sensitive = true
}
