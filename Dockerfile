# ================================
# TMS CONNECT — DOCKERFILE BACKEND
# Multi-stage build optimisé
# ================================

# ── Stage 1 : Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les manifestes de dépendances
COPY package.json package-lock.json* ./

# Installer toutes les dépendances (y compris devDependencies)
RUN npm ci --frozen-lockfile

# Copier les sources
COPY tsconfig.json ./
COPY src ./src

# Compiler TypeScript
RUN npm run build

# ── Stage 2 : Image de production légère
FROM node:20-alpine AS production

# Métadonnées
LABEL maintainer="Touba Mbacké Santé <ndiayestar43@gmail.com>"
LABEL description="TMS Connect Backend API"
LABEL version="1.0.0"

# Dépendances système nécessaires à PDFKit et autres
RUN apk add --no-cache \
    dumb-init \
    fontconfig \
    freetype \
    && rm -rf /var/cache/apk/*

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S tmsgroup && \
    adduser -S tmsuser -u 1001 -G tmsgroup

WORKDIR /app

# Copier uniquement les dépendances de production
COPY package.json package-lock.json* ./
RUN npm ci --only=production --frozen-lockfile && \
    npm cache clean --force

# Copier le build compilé depuis le stage builder
COPY --from=builder /app/dist ./dist

# Créer le dossier logs
RUN mkdir -p logs && chown -R tmsuser:tmsgroup /app

# Passer à l'utilisateur non-root
USER tmsuser

# Exposer le port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => { if(r.statusCode===200) process.exit(0); else process.exit(1); }).on('error', () => process.exit(1));"

# Démarrer avec dumb-init pour la gestion des signaux
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]
