# Holds only the .env secret's container, never its value: terraform.tfstate lives on
# disk unencrypted, so any value Terraform manages would sit there in plaintext. The
# actual payload is pushed directly via `aws secretsmanager put-secret-value`, bypassing
# state entirely. Mirrors ../gcp/secret-manager.tf.
#
# recovery_window_in_days = 0 purges on destroy instead of holding the name for 30 days:
# the payload is a local .env file, so there is nothing here to recover, and an
# environment that gets destroyed and recreated must be able to reuse its own name.
resource "aws_secretsmanager_secret" "vm_env" {
  name                    = "${local.name}-env"
  recovery_window_in_days = 0
}

resource "aws_iam_role_policy" "vm_env_accessor" {
  name = "${local.name}-env-access"
  role = aws_iam_role.vm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.vm_env.arn
    }]
  })
}
