# Holds only the .env secret's container, never its value: terraform.tfstate lives on
# disk unencrypted, so any value Terraform manages would sit there in plaintext. The
# actual payload is pushed directly via `aws secretsmanager put-secret-value`, bypassing
# state entirely. Mirrors ../gcp/secret-manager.tf.
#
# Deleting a secret starts a recovery window (30 days by default), during which the name
# stays taken — `terraform destroy` followed by a fresh apply fails on the name unless
# the old one is purged with `--force-delete-without-recovery`.
resource "aws_secretsmanager_secret" "vm_env" {
  name = "${local.name}-env"
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
