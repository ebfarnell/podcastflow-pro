#!/bin/bash

# Script to fix all API route parameter patterns for Next.js 14.1.0 compatibility
echo "🔧 Fixing API route parameter patterns for Next.js 14.1.0..."

# Find all files with the old parameter pattern
FILES=$(grep -r "params: { [^}]*: string" src/app/api --include="*.ts" -l)

for file in $FILES; do
    echo "Fixing: $file"
    
    # Replace the parameter type declaration
    sed -i 's/{ params }: { params: { \([^}]*\) } }/{ params }: { params: Promise<{ \1 }> }/g' "$file"
    
    # Add await params destructuring after each try { block
    # This is a bit complex because we need to handle multiple patterns
    if grep -q "async function.*Handler" "$file"; then
        # For handler pattern files, add after each try { 
        sed -i '/^  try {$/a\    // Await async params in Next.js 14.1.0\n    const { id } = await params\n' "$file"
    fi
done

echo "✅ Fixed parameter patterns in $(echo "$FILES" | wc -l) files"