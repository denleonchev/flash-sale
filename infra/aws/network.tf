# Default VPC, mirroring the reference GCP root's use of the default network.
data "aws_vpc" "default" {
  default = true
}

# us-east-1e does not offer every instance type (t3 among them), and the default VPC has
# a subnet there — so subnets are narrowed to the zones that actually sell var.instance_type
# rather than pinning an availability zone by hand.
data "aws_ec2_instance_type_offerings" "supported" {
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }

  location_type = "availability-zone"
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "availability-zone"
    values = data.aws_ec2_instance_type_offerings.supported.locations
  }
}

# No SSH ingress on purpose: shell access goes through SSM Session Manager, which is
# outbound-only. The GCP twin needs an equivalent rule for the IAP range; here the
# rule simply does not exist.
resource "aws_security_group" "vm" {
  name        = "${local.name}-vm"
  description = "Public HTTP/HTTPS for Caddy; no inbound SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_eip" "vm" {
  domain = "vpc"
}

resource "aws_eip_association" "vm" {
  instance_id   = aws_instance.vm.id
  allocation_id = aws_eip.vm.id
}

resource "cloudflare_dns_record" "flash_sale_app" {
  zone_id = var.cloudflare_zone_id
  name    = var.subdomain
  type    = "A"
  content = aws_eip.vm.public_ip
  ttl     = 1
  proxied = false
}
