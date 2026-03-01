#!/bin/bash
# EMERGENCY FIX - Run this on your VPS to fix the failed migration

echo "=== Fixing Failed Migration on peppermint-rental ==="

# Step 1: Mark the failed migration as rolled back
echo "Step 1: Marking failed migration as rolled back..."
docker exec -it peppermint-rental sh -c "cd apps/api && npx prisma migrate resolve --rolled-back 20260301000001_remove_ticket_confirmation"

if [ $? -eq 0 ]; then
    echo "✓ Migration marked as rolled back"
else
    echo "✗ Failed to mark migration. Trying manual database fix..."
    
    # Get PostgreSQL container name
    read -p "Enter your PostgreSQL container name (e.g., peppermint-db-rental): " POSTGRES_CONTAINER
    
    # Manual fix in database
    docker exec -it $POSTGRES_CONTAINER psql -U peppermint peppermint_rental -c "
        -- Mark the migration as rolled back
        UPDATE \"_prisma_migrations\" 
        SET finished_at = NULL, 
            rolled_back_at = NOW(),
            applied_steps_count = 0
        WHERE migration_name = '20260301000001_remove_ticket_confirmation';
    "
fi

# Step 2: Pull the new fixed image
echo "Step 2: Pulling fixed Docker image..."
docker pull ghcr.io/sgpromantis/peppermint:latest

# Step 3: Restart the container
echo "Step 3: Restarting peppermint-rental..."
docker restart peppermint-rental

# Step 4: Watch logs
echo "Step 4: Watching logs for migration..."
echo "Press Ctrl+C to exit logs once you see 'Connected to Prisma'"
docker logs peppermint-rental -f
