# Role assumed by the deploy workflow through GitHub's OIDC provider — no long-lived
# keys in repository secrets. The trust condition pins one GitHub Environment per role,
# so the stage deploy cannot touch prod even while both live in one AWS account.

data "aws_caller_identity" "current" {}

locals {
  # GitHub Environments are named "stage" and "production"; this root uses stage/prod.
  github_environment = var.environment == "prod" ? "production" : var.environment
}

# Only one provider for a given issuer may exist per account. With both environments in
# one account, the second workspace reuses the first one's ARN via var.github_oidc_provider_arn.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.github_oidc_provider_arn == "" ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # Vestigial for this issuer — AWS validates GitHub's certificate against its own trust
  # store and ignores the value. Kept equal to what the provider already carries so the
  # plan does not churn.
  thumbprint_list = ["ab9d0263244dd0326eb67015705a667e79cfe998"]
}

locals {
  github_oidc_provider_arn = var.github_oidc_provider_arn != "" ? var.github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn
}

resource "aws_iam_role" "github_deploy" {
  name = "${local.name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${local.github_environment}"
        }
      }
    }]
  })
}

# Deploys run as an SSM command on one specific instance — the role cannot reach any
# other host, and cannot do anything but run that document.
resource "aws_iam_role_policy" "github_deploy" {
  name = "${local.name}-github-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:SendCommand"]
        Resource = [
          "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.vm.id}",
          "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:ListCommands",
          "ssm:ListCommandInvocations",
          "ssm:DescribeInstanceInformation",
        ]
        Resource = "*"
      }
    ]
  })
}

output "github_deploy_role_arn" {
  description = "Put into the GitHub Environment secret AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}

output "github_oidc_provider_arn" {
  description = "Pass to the other workspace as github_oidc_provider_arn while both share one account."
  value       = local.github_oidc_provider_arn
}
