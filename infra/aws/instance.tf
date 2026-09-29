data "aws_ami" "debian" {
  most_recent = true
  owners      = ["136693071363"] # Debian's official AWS account

  filter {
    name   = "name"
    values = ["debian-12-amd64-*"]
  }
}

resource "aws_instance" "vm" {
  ami                    = data.aws_ami.debian.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.vm.id]
  iam_instance_profile   = aws_iam_instance_profile.vm.name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  user_data = templatefile("${path.module}/scripts/user-data.sh", {
    secret_id = aws_secretsmanager_secret.vm_env.name
    region    = var.region
  })

  # Re-runs user-data when the script changes, the way a GCE startup-script does on reset.
  user_data_replace_on_change = true

  tags = {
    Name = local.name
  }
}
