#!/bin/bash

# Update Peppermint Containers on VPS (Linux/Mac version)
# This script helps you update your running containers with the new image

echo "=== Peppermint Container Update Script ==="
echo "This script provides commands to update your VPS containers"

echo -e "\n=== OPTION 1: Update peppermint-rental instance ==="
echo "# Pull latest image"
echo "docker pull ghcr.io/sgpromantis/peppermint:latest"
echo ""
echo "# Stop and remove old container"
echo "docker stop peppermint-rental"
echo "docker rm peppermint-rental"
echo ""
echo "# Start new container (UPDATE YOUR ENV VARIABLES!)"
echo "docker run -d \\"
echo "  --name peppermint-rental \\"
echo "  --restart always \\"
echo "  -p 3000:3000 -p 5003:5003 \\"
echo "  -e DB_USERNAME=\"peppermint\" \\"
echo "  -e DB_PASSWORD=\"your_password\" \\"
echo "  -e DB_HOST=\"your_db_host\" \\"
echo "  -e SECRET=\"your_secret\" \\"
echo "  ghcr.io/sgpromantis/peppermint:latest"

echo -e "\n=== OPTION 2: Update peppermint-admin instance ==="
echo "docker pull ghcr.io/sgpromantis/peppermint:latest"
echo "docker stop peppermint-admin"
echo "docker rm peppermint-admin"
echo "docker run -d \\"
echo "  --name peppermint-admin \\"
echo "  --restart always \\"
echo "  -p 3001:3000 -p 5004:5003 \\"
echo "  -e DB_USERNAME=\"peppermint\" \\"
echo "  -e DB_PASSWORD=\"your_password\" \\"
echo "  -e DB_HOST=\"your_db_host\" \\"
echo "  -e SECRET=\"your_secret\" \\"
echo "  ghcr.io/sgpromantis/peppermint:latest"

echo -e "\n=== Verify Migrations ==="
echo "# Check migration status:"
echo "docker exec -it peppermint-rental sh -c 'cd apps/api && npx prisma migrate status'"
echo ""
echo "# View logs:"
echo "docker logs peppermint-rental -f"

echo -e "\n=== Quick Update Command ==="
echo "docker pull ghcr.io/sgpromantis/peppermint:latest && docker stop peppermint-rental && docker rm peppermint-rental && docker run -d --name peppermint-rental --restart always -p 3000:3000 -p 5003:5003 -e DB_USERNAME=\"peppermint\" -e DB_PASSWORD=\"your_password\" -e DB_HOST=\"your_db_host\" -e SECRET=\"your_secret\" ghcr.io/sgpromantis/peppermint:latest"

echo -e "\n=== Done ==="
