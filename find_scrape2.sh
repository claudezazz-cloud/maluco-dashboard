#!/bin/bash
echo "Checking /root, /opt, /home, /var for scrape.js (max depth 4)..."
find /root /opt /home /var -maxdepth 4 -name "scrape.js" 2>/dev/null | while read FILE; do
    echo "=== $FILE ==="
    cat "$FILE"
done
