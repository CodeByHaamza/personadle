# docker/php/Dockerfile — PHP + Apache pour PersonaDLE, MÊME version que la prod (8.2)
#
# Extensions installées :
#   pdo_mysql   → connexion à MariaDB via PDO (obligatoire)
#   mbstring    → manipulation de chaînes UTF-8 (pseudos, emails)
#   intl        → Intl.DateTimeFormat côté PHP si besoin (futureproof)
#   opcache     → cache du bytecode PHP (performances en dev)
#
# Apache : mod_rewrite activé pour les URLs propres de l'API REST,
#          mod_headers activé pour le Content-Security-Policy des pages HTML (.htaccess racine).

# Hostinger tourne en PHP 8.2 : dev, CI et préprod aussi. Vécu le 2026-09-19 : en 8.3 le client
# MySQL négocie une autre collation de connexion, et une requête qui plantait en prod (« Illegal
# mix of collations », GET /api/titles en 500 pour tous) passait partout ailleurs. Une préprod qui
# ne reproduit pas la prod ne protège de rien. Autre version : --build-arg PHP_VERSION=8.3
ARG PHP_VERSION=8.2
FROM php:${PHP_VERSION}-apache

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
