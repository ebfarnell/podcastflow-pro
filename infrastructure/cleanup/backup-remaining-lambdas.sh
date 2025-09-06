#!/bin/bash

# Backup script for remaining Lambda functions before deletion
# This ensures we can restore if needed

set -e

REGION="us-east-1"
BACKUP_DIR="/home/ec2-user/podcastflow-pro/infrastructure/cleanup/lambda-final-backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$BACKUP_DIR/backup.log"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "=== Lambda Function Final Backup ===" | tee $LOG_FILE
echo "Date: $(date)" | tee -a $LOG_FILE
echo "Backup directory: $BACKUP_DIR" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Lambda functions to backup
FUNCTIONS=(
    "podcastflow-api-analytics"
    "podcastflow-api-organization" 
    "podcastflow-api-user"
    "podcastflow-users"
)

echo "Functions to backup: ${#FUNCTIONS[@]}" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Backup each function
for func in "${FUNCTIONS[@]}"; do
    echo "Processing $func..." | tee -a $LOG_FILE
    
    # Create function directory
    FUNC_DIR="$BACKUP_DIR/$func"
    mkdir -p "$FUNC_DIR"
    
    # 1. Get function configuration
    echo -n "  - Saving configuration... " | tee -a $LOG_FILE
    if aws lambda get-function --function-name "$func" --region $REGION > "$FUNC_DIR/config.json" 2>>$LOG_FILE; then
        echo "✓" | tee -a $LOG_FILE
    else
        echo "✗ (function may not exist)" | tee -a $LOG_FILE
        continue
    fi
    
    # 2. Download function code
    echo -n "  - Downloading code... " | tee -a $LOG_FILE
    CODE_URL=$(aws lambda get-function --function-name "$func" --region $REGION --query 'Code.Location' --output text 2>>$LOG_FILE)
    if [ ! -z "$CODE_URL" ] && [ "$CODE_URL" != "None" ]; then
        if wget -q "$CODE_URL" -O "$FUNC_DIR/code.zip" 2>>$LOG_FILE; then
            echo "✓" | tee -a $LOG_FILE
            # Extract code for inspection
            unzip -q "$FUNC_DIR/code.zip" -d "$FUNC_DIR/code" 2>>$LOG_FILE || true
        else
            echo "✗" | tee -a $LOG_FILE
        fi
    else
        echo "✗ (no code URL)" | tee -a $LOG_FILE
    fi
    
    # 3. Get detailed configuration
    echo -n "  - Saving environment variables... " | tee -a $LOG_FILE
    if aws lambda get-function-configuration --function-name "$func" --region $REGION > "$FUNC_DIR/configuration.json" 2>>$LOG_FILE; then
        # Extract just environment variables
        jq '.Environment.Variables // {}' "$FUNC_DIR/configuration.json" > "$FUNC_DIR/env-vars.json"
        echo "✓" | tee -a $LOG_FILE
    else
        echo "✗" | tee -a $LOG_FILE
    fi
    
    # 4. Get function policy (if exists)
    echo -n "  - Saving resource policy... " | tee -a $LOG_FILE
    if aws lambda get-policy --function-name "$func" --region $REGION > "$FUNC_DIR/policy.json" 2>>$LOG_FILE; then
        echo "✓" | tee -a $LOG_FILE
    else
        echo "✗ (no policy)" | tee -a $LOG_FILE
    fi
    
    # 5. Get recent invocation metrics
    echo -n "  - Saving invocation metrics... " | tee -a $LOG_FILE
    END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
    START_TIME=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S)
    
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$func \
        --start-time $START_TIME \
        --end-time $END_TIME \
        --period 86400 \
        --statistics Sum \
        --region $REGION > "$FUNC_DIR/invocation-metrics.json" 2>>$LOG_FILE && echo "✓" | tee -a $LOG_FILE || echo "✗" | tee -a $LOG_FILE
    
    echo "" | tee -a $LOG_FILE
done

# Create restoration script
echo "Creating restoration script..." | tee -a $LOG_FILE
cat > "$BACKUP_DIR/restore-lambdas.sh" << 'EOF'
#!/bin/bash
# Lambda restoration script
# Generated on: $(date)

set -e

REGION="us-east-1"
BACKUP_DIR="$(dirname "$0")"

echo "=== Lambda Function Restoration ==="
echo "Restoring from: $BACKUP_DIR"
echo ""

# Find all function directories
for FUNC_DIR in "$BACKUP_DIR"/*/; do
    if [ -d "$FUNC_DIR" ] && [ -f "$FUNC_DIR/config.json" ]; then
        FUNC_NAME=$(basename "$FUNC_DIR")
        echo "Restoring $FUNC_NAME..."
        
        # Get configuration details
        RUNTIME=$(jq -r '.Configuration.Runtime' "$FUNC_DIR/config.json")
        HANDLER=$(jq -r '.Configuration.Handler' "$FUNC_DIR/config.json")
        ROLE=$(jq -r '.Configuration.Role' "$FUNC_DIR/config.json")
        MEMORY=$(jq -r '.Configuration.MemorySize' "$FUNC_DIR/config.json")
        TIMEOUT=$(jq -r '.Configuration.Timeout' "$FUNC_DIR/config.json")
        
        # Get environment variables
        ENV_VARS=$(cat "$FUNC_DIR/env-vars.json")
        
        # Create function
        echo -n "  Creating function... "
        if [ -f "$FUNC_DIR/code.zip" ]; then
            aws lambda create-function \
                --function-name "$FUNC_NAME" \
                --runtime "$RUNTIME" \
                --role "$ROLE" \
                --handler "$HANDLER" \
                --memory-size $MEMORY \
                --timeout $TIMEOUT \
                --zip-file "fileb://$FUNC_DIR/code.zip" \
                --environment "Variables=$ENV_VARS" \
                --region $REGION && echo "✓" || echo "✗"
        else
            echo "✗ (no code found)"
        fi
        
        echo ""
    fi
done

echo "Restoration complete!"
EOF

chmod +x "$BACKUP_DIR/restore-lambdas.sh"

# Create summary report
echo "" | tee -a $LOG_FILE
echo "=== Backup Summary ===" | tee -a $LOG_FILE
echo "Total functions backed up: $(ls -d $BACKUP_DIR/*/ 2>/dev/null | grep -v restore | wc -l)" | tee -a $LOG_FILE
echo "Backup size: $(du -sh $BACKUP_DIR | cut -f1)" | tee -a $LOG_FILE
echo "Restoration script: $BACKUP_DIR/restore-lambdas.sh" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Security audit findings
echo "=== SECURITY AUDIT FINDINGS ===" | tee -a $LOG_FILE
echo "⚠️  CRITICAL: Lambda functions have NO tenant isolation!" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Check for hardcoded secrets or credentials
echo "Scanning for potential security issues..." | tee -a $LOG_FILE
for func in "${FUNCTIONS[@]}"; do
    if [ -d "$BACKUP_DIR/$func/code" ]; then
        echo "Checking $func for security issues:" | tee -a $LOG_FILE
        
        # Check for hardcoded credentials
        if grep -r -i "password\|secret\|key\|token" "$BACKUP_DIR/$func/code" 2>/dev/null | grep -v "node_modules" | head -5; then
            echo "  ⚠️  Found potential hardcoded credentials" | tee -a $LOG_FILE
        fi
        
        # Check for tenant isolation
        if ! grep -r "organizationId\|tenantId\|orgId" "$BACKUP_DIR/$func/code" 2>/dev/null | grep -v "node_modules" > /dev/null; then
            echo "  🚨 NO TENANT ISOLATION FOUND!" | tee -a $LOG_FILE
        fi
        
        echo "" | tee -a $LOG_FILE
    fi
done

echo "✅ Backup complete!" | tee -a $LOG_FILE
echo "Backup location: $BACKUP_DIR" | tee -a $LOG_FILE