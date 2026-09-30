#!/bin/bash
set -e
apt update
apt install -y ca-certificates curl git jq unzip
if ! id -u deployer >/dev/null 2>&1; then
  useradd -m -s /bin/bash deployer
fi

# 1 GiB of RAM leaves little headroom once the worker loads the embedding model, and an
# OOM kill there takes the whole container down. Swap turns that into slowness instead.
# swappiness stays low so it is only touched under real pressure.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
fi

# Debian AMIs ship without the SSM agent, and no SSH port is open — without this the
# instance is unreachable, including for CI deploys.
ARCH=$(dpkg --print-architecture)
curl -fsSL "https://s3.${region}.amazonaws.com/amazon-ssm-${region}/latest/debian_$${ARCH}/amazon-ssm-agent.deb" \
  -o /tmp/amazon-ssm-agent.deb
dpkg -i /tmp/amazon-ssm-agent.deb
systemctl enable --now amazon-ssm-agent

curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install --update

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deployer

# cloud-init runs user-data once per instance, unlike a GCE startup-script, which runs on
# every boot. The repo checkout and the .env fetch belong to every boot (that is how a
# freshly pushed secret reaches the VM — push it, reboot), so they live in a per-boot
# script instead. Same division of labour as ../../gcp/scripts/startup.sh.
mkdir -p /var/lib/cloud/scripts/per-boot
cat > /var/lib/cloud/scripts/per-boot/10-flash-sale.sh <<'PERBOOT'
#!/bin/bash
set -e

# git refuses to operate on a repository owned by another user ("dubious ownership"),
# and this script runs as root while the checkout belongs to deployer — so git runs as
# the owner rather than marking the directory safe globally.
if [ -d /home/deployer/flash-sale/.git ]; then
  runuser -u deployer -- git -C /home/deployer/flash-sale pull
else
  runuser -u deployer -- git clone https://github.com/denleonchev/flash-sale.git \
    /home/deployer/flash-sale
fi

# .env never passes through Terraform state: it is pushed straight into Secrets Manager
# with `aws secretsmanager put-secret-value` and fetched here with the instance's own
# role. Missing on the very first boot — the secret is filled in after the VM exists, so
# a failed fetch must not abort the rest of the boot.
if aws secretsmanager get-secret-value \
  --secret-id "SECRET_ID_PLACEHOLDER" \
  --region "REGION_PLACEHOLDER" \
  --query SecretString \
  --output text > /home/deployer/flash-sale/.env.new 2>/dev/null; then
  mv /home/deployer/flash-sale/.env.new /home/deployer/flash-sale/.env
  chmod 600 /home/deployer/flash-sale/.env
else
  rm -f /home/deployer/flash-sale/.env.new
  echo "secret is empty or unreadable — leaving .env untouched"
fi

chown -R deployer:deployer /home/deployer/flash-sale
PERBOOT

sed -i "s|SECRET_ID_PLACEHOLDER|${secret_id}|; s|REGION_PLACEHOLDER|${region}|" \
  /var/lib/cloud/scripts/per-boot/10-flash-sale.sh
chmod +x /var/lib/cloud/scripts/per-boot/10-flash-sale.sh

# First boot: cloud-init has already passed the per-boot stage by the time this runs.
/var/lib/cloud/scripts/per-boot/10-flash-sale.sh
