resource "auth0_client" "e2e" {
  name     = "flash-sale-web-e2e"
  app_type = "regular_web"

  callbacks           = ["http://localhost:3000/auth/callback"]
  allowed_logout_urls = ["http://localhost:3000"]
  allowed_origins     = ["http://localhost:3000"]
}

resource "auth0_client_credentials" "e2e" {
  client_id             = auth0_client.e2e.id
  authentication_method = "client_secret_post"
}

data "auth0_connection" "username_password" {
  name = "Username-Password-Authentication"
}

resource "auth0_connection_client" "e2e_username_password" {
  connection_id = data.auth0_connection.username_password.id
  client_id     = auth0_client.e2e.id
}

output "auth0_e2e_client_id" {
  value = auth0_client.e2e.client_id
}

output "auth0_e2e_client_secret" {
  value     = auth0_client_credentials.e2e.client_secret
  sensitive = true
}
