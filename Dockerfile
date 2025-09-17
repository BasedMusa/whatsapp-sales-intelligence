# Dockerfile for Evolution API deployment
FROM evoapicloud/evolution-api:latest

# Set environment variables for Render
ENV NODE_ENV=production
ENV SERVER_PORT=8080
ENV SERVER_URL=https://whatsapp-sales.onrender.com

# Expose port for Render
EXPOSE 8080

# Start Evolution API
CMD ["npm", "run", "start:prod"]