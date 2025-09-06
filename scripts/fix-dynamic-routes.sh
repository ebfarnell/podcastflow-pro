#!/bin/bash

# Find all route.ts files in the API directory
echo "Fixing dynamic route exports..."

# Counter for fixed files
fixed=0

# Find all route.ts files
find /home/ec2-user/podcastflow-pro/src/app/api -name "route.ts" | while read file; do
    # Check if file uses cookies, headers, or any auth-related function
    if grep -q -E "(cookies|headers\(\)|validateSession|withApiProtection)" "$file"; then
        # Check if it already has the dynamic export
        if ! grep -q "export const dynamic" "$file"; then
            echo "Adding dynamic export to: $file"
            
            # Add the export at the beginning of the file, after any imports
            # First, check if there are import statements
            if grep -q "^import" "$file"; then
                # Find the last import line and add the export after it
                awk '
                    /^import/ { imports = imports $0 "\n"; next }
                    !printed && !/^import/ && NR > 1 { 
                        print imports
                        print "// Force dynamic rendering for routes that use cookies/auth"
                        print "export const dynamic = '\''force-dynamic'\''\n"
                        printed = 1
                    }
                    { if (!imports || printed) print }
                    END { if (!printed && imports) {
                        print imports
                        print "// Force dynamic rendering for routes that use cookies/auth"
                        print "export const dynamic = '\''force-dynamic'\''"
                    }}
                ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
            else
                # No imports, add at the beginning
                echo -e "// Force dynamic rendering for routes that use cookies/auth\nexport const dynamic = 'force-dynamic'\n\n$(cat "$file")" > "$file"
            fi
            
            ((fixed++))
        fi
    fi
done

echo "✅ Fixed $fixed files with missing dynamic exports"

# Also fix pages that might have the same issue
echo "Checking pages for dynamic rendering issues..."

# Find pages that use useSearchParams or other dynamic features
find /home/ec2-user/podcastflow-pro/src/app -name "page.tsx" -not -path "*/api/*" | while read file; do
    if grep -q -E "(useSearchParams|cookies)" "$file"; then
        if ! grep -q "export const dynamic" "$file"; then
            echo "Adding dynamic export to page: $file"
            
            # For pages, we need to be more careful about where we add the export
            # Add it after the 'use client' directive if present
            if grep -q "^'use client'" "$file"; then
                sed -i "/^'use client'/a\\\\n// Force dynamic rendering\\nexport const dynamic = 'force-dynamic'" "$file"
            else
                # Add at the beginning for server components
                echo -e "// Force dynamic rendering\nexport const dynamic = 'force-dynamic'\n\n$(cat "$file")" > "$file"
            fi
        fi
    fi
done

echo "✅ Dynamic route fixes complete!"