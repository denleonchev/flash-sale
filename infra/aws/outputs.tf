output "public_ip" {
  value = aws_eip.vm.public_ip
}

output "instance_id" {
  description = "Target for `aws ssm start-session` and the CI deploy job."
  value       = aws_instance.vm.id
}

output "app_url" {
  value = "https://${local.app_domain}"
}
