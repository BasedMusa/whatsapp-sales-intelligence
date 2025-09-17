# Dockerfile for Evolution API deployment
FROM evoapicloud/evolution-api:latest

# Set environment variables for Render
ENV NODE_ENV=production
ENV SERVER_PORT=8080
ENV SERVER_URL=https://whatsapp-sales.onrender.com
ENV DATABASE_PROVIDER=
ENV DATABASE_ENABLED=false

# Expose port for Render
EXPOSE 8080

# Skip database migration and start directly
CMD ["npm", "run", "start:prod"]