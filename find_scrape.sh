#!/bin/bash
echo "Locating scrape.js..."
FILE=$(find / -name "scrape.js" -not -path "*/node_modules/*" 2>/dev/null | head -n 1)

if [ -z "$FILE" ]; then
    echo "Could not find scrape.js"
else
    echo "Found at: $FILE"
    echo "--- CONTENT ---"
    cat "$FILE"
fi
