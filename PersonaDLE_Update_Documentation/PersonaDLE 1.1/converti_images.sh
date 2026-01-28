#!/bin/bash

echo "🔄 Conversion des images WebP en PNG..."

# Installe imagemagick si nécessaire
sudo apt install imagemagick -y

# Crée un dossier pour les images converties
mkdir -p images_converted

# Convertit toutes les WebP en PNG
for file in images/*.webp; do
    if [ -f "$file" ]; then
        filename=$(basename "$file" .webp)
        convert "$file" "images_converted/${filename}.png"
        echo "✅ Converti: $filename.webp → $filename.png"
    fi
done

# Copie les autres formats (jpg, jpeg, png) sans conversion
for file in images/*.{jpg,jpeg,png}; do
    if [ -f "$file" ]; then
        cp "$file" images_converted/
        echo "📋 Copié: $(basename "$file")"
    fi
done

echo "✅ Conversion terminée! Images dans ./images_converted/"