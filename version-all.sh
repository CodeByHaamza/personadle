#!/bin/bash

# Script pour ajouter ?v=3 à TOUS les fichiers JS et CSS dans les HTML
# Usage: ./version-all.sh

echo "🚀 Adding ?v=3 to all JS and CSS files..."

# Trouve tous les fichiers HTML
find . -name "*.html" -type f | while read -r file; do
    echo "📝 Processing: $file"
    
    # Backup
    cp "$file" "$file.backup-$(date +%s)"
    
    # Ajoute ?v=3 aux fichiers .js qui n'ont pas déjà de version
    sed -i 's/\(src="[^"]*\.js\)"/\1?v=3"/g' "$file"
    sed -i "s/\(src='[^']*\.js\)'/\1?v=3'/g" "$file"
    
    # Ajoute ?v=3 aux fichiers .css qui n'ont pas déjà de version
    sed -i 's/\(href="[^"]*\.css\)"/\1?v=3"/g' "$file"
    sed -i "s/\(href='[^']*\.css\)'/\1?v=3'/g" "$file"
    
    # Nettoie les doubles versions (si déjà ?v=X, remplace par ?v=3)
    sed -i 's/\?v=[0-9]*/?v=3/g' "$file"
    
    echo "✅ Done: $file"
done

echo ""
echo "🎉 All HTML files updated!"
echo "💾 Backups saved with timestamp"
echo ""
echo "To increment version later, run:"
echo "  sed -i 's/?v=3/?v=2/g' *.html */*.html"