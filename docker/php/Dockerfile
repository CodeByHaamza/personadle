# docker/php/Dockerfile — PHP 8.3 + Apache pour PersonaDLE
#
# Extensions installées :
#   pdo_mysql   → connexion à MariaDB via PDO (obligatoire)
#   mbstring    → manipulation de chaînes UTF-8 (pseudos, emails)
#   intl        → Intl.DateTimeFormat côté PHP si besoin (futureproof)
#   opcache     → cache du bytecode PHP (performances en dev)
#
# Apache : mod_rewrite activé pour les URLs propres de l'API REST,
#          mod_headers activé pour le Content-Security-Policy des pages HTML (.htaccess racine).

FROM php:8.3-apache

# Installer les extensions PDO + utilitaires
RUN apt-get update && apt-get install -y \
        libicu-dev \
        libonig-dev \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        intl \
        opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Activer mod_rewrite (nécessaire pour les endpoints /api/auth/login etc.)
# et mod_headers (nécessaire pour le Header set CSP du .htaccess racine).
RUN a2enmod rewrite headers

# Copier la config Apache du vhost
COPY docker/php/vhost.conf /etc/apache2/sites-available/000-default.conf

# Définir le répertoire de travail
WORKDIR /var/www/html

# Apache tourne en tant que www-data — pas de changement de USER nécessaire
EXPOSE 80
