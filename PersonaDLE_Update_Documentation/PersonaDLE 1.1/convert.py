#!/usr/bin/env python3
import markdown
from weasyprint import HTML, CSS
import re

# Lire le fichier markdown
with open('PersonaDLE_Update.md', 'r', encoding='utf-8') as f:
    md_text = f.read()

# Retirer les métadonnées YAML du début (entre les ---)
lines = md_text.split('\n')
if lines[0].strip() == '---':
    end_index = next((i for i, line in enumerate(lines[1:], 1) if line.strip() == '---'), -1)
    if end_index != -1:
        md_text = '\n'.join(lines[end_index + 1:])

# Remplacer \newpage par un marqueur HTML de saut de page
md_text = re.sub(r'\\newpage', '<div style="page-break-after: always;"></div>', md_text)

# Convertir en HTML
html_content = markdown.markdown(
    md_text,
    extensions=['tables', 'fenced_code', 'attr_list', 'md_in_html']
)

# Template HTML avec CSS amélioré
html_template = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {{
            margin: 2cm;
            @top-center {{
                content: "PersonaDLE v1.1 - Chinese New Year Edition";
                font-size: 9pt;
                color: #666;
            }}
            @bottom-center {{
                content: "Page " counter(page);
                font-size: 9pt;
                color: #666;
            }}
        }}
        
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        
        /* Page de titre */
        h1:first-of-type {{
            color: #e60012;
            font-size: 36pt;
            text-align: center;
            margin-top: 5cm;
            margin-bottom: 1cm;
            border: none;
            page-break-after: always;
        }}
        
        /* Titres */
        h1 {{
            color: #e60012;
            border-bottom: 3px solid #e60012;
            padding-bottom: 10px;
            margin-top: 40px;
            font-size: 28pt;
        }}
        
        h2 {{
            color: #0088cc;
            margin-top: 30px;
            font-size: 20pt;
            border-bottom: 2px solid #0088cc;
            padding-bottom: 8px;
        }}
        
        h3 {{
            color: #555;
            margin-top: 20px;
            font-size: 16pt;
        }}
        
        /* Images */
        img {{
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10px auto;
        }}
        
        /* Tableaux */
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            page-break-inside: avoid;
        }}
        
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: center;
            vertical-align: middle;
        }}
        
        th {{
            background-color: #e60012;
            color: white;
            font-weight: bold;
        }}
        
        tr:nth-child(even) {{
            background-color: #f9f9f9;
        }}
        
        /* Code */
        code {{
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
        }}
        
        /* Liens */
        a {{
            color: #0088cc;
            text-decoration: none;
        }}
        
        a:hover {{
            text-decoration: underline;
        }}
        
        /* Listes */
        ul, ol {{
            margin: 10px 0;
            padding-left: 30px;
        }}
        
        li {{
            margin: 5px 0;
        }}
        
        /* Citations */
        blockquote {{
            border-left: 4px solid #e60012;
            padding-left: 20px;
            margin: 20px 0;
            font-style: italic;
            color: #666;
        }}
        
        /* Séparateurs */
        hr {{
            border: none;
            border-top: 2px solid #ddd;
            margin: 30px 0;
        }}
        
        /* Emphase */
        strong {{
            color: #e60012;
        }}
        
        em {{
            color: #0088cc;
        }}
    </style>
</head>
<body>
    <!-- Page de titre -->
    <div style="text-align: center; page-break-after: always;">
        <h1 style="border: none; margin-top: 5cm;">PersonaDLE</h1>
        <p style="font-size: 24pt; color: #0088cc; margin: 20px 0;">Version 1.1 Update Documentation</p>
        <p style="font-size: 18pt; color: #666; margin: 20px 0;">Chinese New Year Edition</p>
        <p style="font-size: 14pt; color: #999; margin-top: 3cm;">PersonaDLE Team</p>
        <p style="font-size: 12pt; color: #999;">January 2026</p>
    </div>
    
    {html_content}
</body>
</html>
"""

# Générer le PDF
HTML(string=html_template, base_url='.').write_pdf(
    'PersonaDLE_Update_v1.1.pdf',
    stylesheets=[CSS(string='@page { size: A4; }')]
)

print("✅ PDF généré avec succès : PersonaDLE_Update_v1.1.pdf")
print("📄 Avec page de titre personnalisée et sauts de page")
print("🔄 Les \\newpage ont été convertis en vrais sauts de page HTML")