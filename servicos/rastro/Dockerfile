FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
ENV RASTRO_HOST=0.0.0.0 GOOGLE_MAPS_HEADLESS=1
EXPOSE 4310
CMD ["npm", "start"]
