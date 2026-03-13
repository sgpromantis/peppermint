#!/bin/bash

# Update promantis Containers on VPS (Linux/Mac version)
# This script helps you update your running containers with the new image

echo "=== promantis Container Update Script ==="
echo "This script provides commands to update your VPS containers"

echo -e "\n=== OPTION 1: Update promantis-rental instance ==="
echo "# Pull latest image"
echo "docker pull ghcr.io/sgpromantis/promantis:latest"
echo ""
echo "# Stop and remove old container"
echo "docker stop promantis-rental"
echo "docker rm promantis-rental"
echo ""
echo "# Start new container (UPDATE YOUR ENV VARIABLES!)"
echo "docker run -d \\"
echo "  --name promantis-rental \\"
echo "  --restart always \\"
echo "  -p 3000:3000 -p 5003:5003 \\"
echo "  -e DB_USERNAME=\"promantis\" \\"
echo "  -e DB_PASSWORD=\"your_password\" \\"
echo "  -e DB_HOST=\"your_db_host\" \\"
echo "  -e SECRET=\"your_secret\" \\"
echo "  ghcr.io/sgpromantis/promantis:latest"

echo -e "\n=== OPTION 2: Update promantis-admin instance ==="
echo "docker pull ghcr.io/sgpromantis/promantis:latest"
echo "docker stop promantis-admin"
echo "docker rm promantis-admin"
echo "docker run -d \\"
echo "  --name promantis-admin \\"
echo "  --restart always \\"
echo "  -p 3001:3000 -p 5004:5003 \\"
echo "  -e DB_USERNAME=\"promantis\" \\"
echo "  -e DB_PASSWORD=\"your_password\" \\"
echo "  -e DB_HOST=\"your_db_host\" \\"
echo "  -e SECRET=\"your_secret\" \\"
echo "  ghcr.io/sgpromantis/promantis:latest"

echo -e "\n=== Verify Migrations ==="
echo "# Check migration status:"
echo "docker exec -it promantis-rental sh -c 'cd apps/api && npx prisma migrate status'"
echo ""
echo "# View logs:"
echo "docker logs promantis-rental -f"

echo -e "\n=== Quick Update Command ==="
echo "docker pull ghcr.io/sgpromantis/promantis:latest && docker stop promantis-rental && docker rm promantis-rental && docker run -d --name promantis-rental --restart always -p 3000:3000 -p 5003:5003 -e DB_USERNAME=\"promantis\" -e DB_PASSWORD=\"your_password\" -e DB_HOST=\"your_db_host\" -e SECRET=\"your_secret\" ghcr.io/sgpromantis/promantis:latest"

echo -e "\n=== Done ==="
