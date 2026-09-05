# CityConnect Signaling Server - Deployment Guide

## 1. Environment Preparation (Hostinger VPS / Ubuntu Linux)
The dedicated Socket.IO signaling server should be run independently from the Next.js frontend to ensure stable WebSocket connections and isolated scaling.

Install required dependencies on your VPS:
```bash
sudo apt update
sudo apt install nodejs npm nginx -y
sudo npm install -g pm2
```

## 2. Server Setup
Clone your repository and navigate to the signaling server directory:
```bash
cd /var/www/cityconnect/signaling-server
npm install
```

Create your production environment file (`.env`):
```bash
nano ../.env
```
Ensure these variables are present and secure:
```env
# Required for signaling server standalone operation
PORT=4001
ALLOWED_ORIGIN=https://app.belconnect.in,https://admin.belconnect.in
JWT_SECRET=your_production_jwt_secret
SIGNALING_INTERNAL_SECRET=your_production_signaling_secret
DATABASE_URL=postgresql://user:pass@localhost:5432/cityconnect
```

## 3. Process Management (PM2)
Start the signaling server using PM2 to ensure it restarts automatically on crash or server reboot:
```bash
pm2 start server.js --name "belconnect-signaling"
pm2 save
pm2 startup
```

## 4. Nginx Reverse Proxy Configuration
Configure Nginx to route traffic to the Node.js server and properly upgrade WebSocket connections. 

Create a new Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/signal.belconnect.in
```

Add the following configuration (replace `signal.belconnect.in` with your actual domain):
```nginx
server {
    listen 80;
    server_name signal.belconnect.in;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4001;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward real IPs and Host
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep-Alive tuning for long-polling/websockets
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Health Check endpoint
    location /health {
        proxy_pass http://127.0.0.1:4001/health;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/signal.belconnect.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. SSL / HTTPS (Certbot)
WebSockets require secure transport (`wss://` and `https://`) to work properly in modern browsers.
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d signal.belconnect.in
```

## 6. Frontend Next.js Configuration Update
Once the signaling server is deployed, update your frontend's environment variable (in your Vercel or VPS environment settings):
```env
NEXT_PUBLIC_SIGNALING_URL=https://signal.belconnect.in
```
Redeploy the frontend. Your app is now decoupled and ready for production realtime calling!
