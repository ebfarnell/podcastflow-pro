#!/bin/bash

# Automated PostgreSQL Backup Script for PodcastFlow Pro
# Supports full and per-tenant backups with encryption

set -e

# Configuration
BACKUP_DIR="/home/ec2-user/podcastflow-pro/backups"
S3_BUCKET="${BACKUPS_BUCKET_NAME:-podcastflow-backups}"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="podcastflow_production"
DB_USER="podcastflow"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}

# Backup types
BACKUP_TYPE=${1:-"full"} # full, tenant, or schema name
TENANT_SCHEMA=${2:-""} # Required if type is "tenant"

# Create backup directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="podcastflow-backup-${BACKUP_TYPE}-${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

# Logging
LOG_FILE="$BACKUP_PATH/backup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "=== PodcastFlow Pro Automated Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Type: $BACKUP_TYPE"
echo "Backup Path: $BACKUP_PATH"
echo ""

# Function to encrypt file
encrypt_file() {
    local input_file=$1
    local output_file="${input_file}.enc"
    
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "$input_file" \
        -out "$output_file" \
        -pass pass:"$ENCRYPTION_KEY"
    
    # Remove unencrypted file
    rm -f "$input_file"
    
    echo "$output_file"
}

# Function to backup a specific schema
backup_schema() {
    local schema_name=$1
    local backup_file="$BACKUP_PATH/${schema_name}_backup.sql"
    
    echo "Backing up schema: $schema_name"
    
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --schema="$schema_name" \
        --no-owner \
        --no-privileges \
        --verbose \
        -f "$backup_file" 2>&1 | grep -v "^Password:"
    
    # Compress
    gzip "$backup_file"
    backup_file="${backup_file}.gz"
    
    # Encrypt
    encrypted_file=$(encrypt_file "$backup_file")
    
    echo "✓ Schema $schema_name backed up to: $(basename $encrypted_file)"
    echo ""
    
    return 0
}

# Check database password
if [ -z "$DB_PASSWORD" ]; then
    # Try to get from environment or AWS Secrets Manager
    if [ -n "$DATABASE_URL" ]; then
        # Extract password from DATABASE_URL
        DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    else
        echo "Error: DB_PASSWORD not set"
        exit 1
    fi
fi

# Start backup based on type
case $BACKUP_TYPE in
    "full")
        echo "Performing FULL database backup..."
        
        # 1. Backup global objects (roles, tablespaces)
        echo "Backing up global objects..."
        PGPASSWORD="$DB_PASSWORD" pg_dumpall \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            --globals-only \
            --no-role-passwords \
            -f "$BACKUP_PATH/globals.sql" 2>&1 | grep -v "^Password:"
        
        gzip "$BACKUP_PATH/globals.sql"
        encrypt_file "$BACKUP_PATH/globals.sql.gz"
        
        # 2. Backup public schema (shared data)
        backup_schema "public"
        
        # 3. Backup all organization schemas
        echo "Finding organization schemas..."
        SCHEMAS=$(PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'org_%' ORDER BY schema_name;")
        
        for schema in $SCHEMAS; do
            backup_schema "$schema"
        done
        
        # 4. Create metadata file
        cat > "$BACKUP_PATH/metadata.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "type": "full",
    "database": "$DB_NAME",
    "schemas": $(echo $SCHEMAS | jq -R -s -c 'split("\n") | map(select(length > 0))')
    "encryption": "aes-256-cbc",
    "compressed": true,
    "version": "1.0"
}
EOF
        ;;
        
    "tenant")
        if [ -z "$TENANT_SCHEMA" ]; then
            echo "Error: Tenant schema name required"
            echo "Usage: $0 tenant <schema_name>"
            exit 1
        fi
        
        echo "Performing TENANT backup for: $TENANT_SCHEMA"
        
        # Verify schema exists
        SCHEMA_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = '$TENANT_SCHEMA';" | tr -d ' ')
        
        if [ "$SCHEMA_EXISTS" != "1" ]; then
            echo "Error: Schema '$TENANT_SCHEMA' does not exist"
            exit 1
        fi
        
        # Backup the tenant schema
        backup_schema "$TENANT_SCHEMA"
        
        # Create metadata
        cat > "$BACKUP_PATH/metadata.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "type": "tenant",
    "database": "$DB_NAME",
    "schema": "$TENANT_SCHEMA",
    "encryption": "aes-256-cbc",
    "compressed": true,
    "version": "1.0"
}
EOF
        ;;
        
    *)
        # Assume it's a specific schema name
        echo "Performing backup for schema: $BACKUP_TYPE"
        backup_schema "$BACKUP_TYPE"
        ;;
esac

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo "Backup size: $BACKUP_SIZE"

# Upload to S3
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$S3_BUCKET" ]; then
    echo -e "\nUploading to S3..."
    
    # Create tarball
    TARBALL="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    tar -czf "$TARBALL" -C "$BACKUP_DIR" "$BACKUP_NAME"
    
    # Upload with server-side encryption
    aws s3 cp "$TARBALL" "s3://$S3_BUCKET/backups/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "backup-type=$BACKUP_TYPE,timestamp=$TIMESTAMP"
    
    if [ $? -eq 0 ]; then
        echo "✓ Backup uploaded to S3: s3://$S3_BUCKET/backups/$(basename $TARBALL)"
        
        # Remove local tarball
        rm -f "$TARBALL"
    else
        echo "✗ Failed to upload to S3"
    fi
else
    echo "S3 upload skipped (AWS credentials not configured)"
fi

# Clean up old backups
echo -e "\nCleaning up old backups..."

# Local cleanup
find "$BACKUP_DIR" -name "podcastflow-backup-*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true

# S3 cleanup
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$S3_BUCKET" ]; then
    # List and delete old S3 backups
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
    
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "Contents[?LastModified<'$CUTOFF_DATE'].Key" \
        --output text | tr '\t' '\n' | while read key; do
        if [ -n "$key" ]; then
            echo "Deleting old backup: $key"
            aws s3 rm "s3://$S3_BUCKET/$key"
        fi
    done
fi

# Generate restore script
cat > "$BACKUP_PATH/restore.sh" << 'RESTORE_SCRIPT'
#!/bin/bash
# Auto-generated restore script

set -e

BACKUP_DIR="$(dirname "$0")"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-podcastflow_production}"
DB_USER="${DB_USER:-podcastflow}"

echo "=== PodcastFlow Pro Restore Script ==="
echo "Backup: $BACKUP_DIR"
echo ""

if [ -z "$DB_PASSWORD" ]; then
    echo "Error: DB_PASSWORD not set"
    exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "Error: ENCRYPTION_KEY not set"
    exit 1
fi

# Function to decrypt file
decrypt_file() {
    local input_file=$1
    local output_file="${input_file%.enc}"
    
    openssl enc -aes-256-cbc -d -pbkdf2 \
        -in "$input_file" \
        -out "$output_file" \
        -pass pass:"$ENCRYPTION_KEY"
    
    echo "$output_file"
}

# Restore process
echo "Decrypting backup files..."
for enc_file in "$BACKUP_DIR"/*.enc; do
    if [ -f "$enc_file" ]; then
        decrypted=$(decrypt_file "$enc_file")
        echo "Decrypted: $(basename $decrypted)"
    fi
done

echo -e "\nDecompressing files..."
for gz_file in "$BACKUP_DIR"/*.gz; do
    if [ -f "$gz_file" ]; then
        gunzip -k "$gz_file"
        echo "Decompressed: $(basename ${gz_file%.gz})"
    fi
done

echo -e "\nReady to restore. Continue? (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
    echo "Restore cancelled"
    exit 1
fi

# Restore globals if present
if [ -f "$BACKUP_DIR/globals.sql" ]; then
    echo -e "\nRestoring global objects..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        -f "$BACKUP_DIR/globals.sql"
fi

# Restore schemas
for sql_file in "$BACKUP_DIR"/*_backup.sql; do
    if [ -f "$sql_file" ]; then
        schema_name=$(basename "$sql_file" _backup.sql)
        echo -e "\nRestoring schema: $schema_name"
        
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$sql_file"
    fi
done

echo -e "\n✓ Restore complete!"
RESTORE_SCRIPT

chmod +x "$BACKUP_PATH/restore.sh"

# Summary
echo -e "\n=== Backup Complete ==="
echo "Location: $BACKUP_PATH"
echo "Size: $BACKUP_SIZE"
echo "Encrypted: Yes"
echo "S3 Upload: $([ -n "$AWS_ACCESS_KEY_ID" ] && echo "Yes" || echo "No")"
echo "Restore script: $BACKUP_PATH/restore.sh"
echo ""
echo "✅ Backup completed successfully!"

# Exit successfully
exit 0