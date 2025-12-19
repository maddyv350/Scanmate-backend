# Troubleshooting "Cannot GET" Error on EC2

## Quick Fix Commands

Run these commands on your EC2 instance to diagnose and fix the issue:

### 1. Check if Application is Running

```bash
pm2 status
pm2 logs scanmate-backend --lines 50
```

If not running, start it:
```bash
cd ~/scanmate-backend
pm2 start server.js --name scanmate-backend
pm2 save
```

### 2. Check if Port is Listening

```bash
sudo netstat -tulpn | grep 8000
# OR
sudo ss -tulpn | grep 8000
```

You should see something like:
```
tcp  0  0 0.0.0.0:8000  0.0.0.0:*  LISTEN  <pid>/node
```

### 3. Test Locally on EC2

```bash
curl http://localhost:8000/health
curl http://127.0.0.1:8000/health
```

If this works, the app is running but external access is blocked.

### 4. Check Security Group (AWS Console)

**CRITICAL:** Your EC2 Security Group must allow inbound traffic:

1. Go to AWS EC2 Console
2. Click on your instance (43.204.209.39)
3. Click on "Security" tab
4. Click on the Security Group link
5. Click "Edit inbound rules"
6. Add these rules if missing:
   - **Type:** Custom TCP
   - **Port:** 8000
   - **Source:** 0.0.0.0/0 (or your specific IP for security)
   - **Description:** Node.js App

   - **Type:** HTTP (or Custom TCP)
   - **Port:** 80
   - **Source:** 0.0.0.0/0
   - **Description:** HTTP (if using Nginx)

7. Click "Save rules"

### 5. Check Ubuntu Firewall (UFW)

```bash
# Check firewall status
sudo ufw status

# If firewall is active, allow ports
sudo ufw allow 8000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH

# Reload firewall
sudo ufw reload
```

### 6. Test External Access

After fixing security group and firewall:

```bash
# From your local machine, test:
curl http://43.204.209.39:8000/health

# Or in browser:
http://43.204.209.39:8000/health
```

### 7. If Using Nginx (Port 80)

If you want to access without port number (http://43.204.209.39), setup Nginx:

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/scanmate-backend
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name 43.204.209.39;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/scanmate-backend /etc/nginx/sites-enabled/

# Remove default (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 8. Verify Application is Binding to 0.0.0.0

Make sure your server.js has:
```javascript
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
```

Then restart:
```bash
pm2 restart scanmate-backend
```

## Common Issues and Solutions

### Issue: "Connection refused"
- **Cause:** Security group not allowing port
- **Fix:** Add inbound rule in Security Group

### Issue: "Timeout"
- **Cause:** Firewall blocking or wrong port
- **Fix:** Check UFW and Security Group

### Issue: "Cannot GET /"
- **Cause:** App running but no route for root path
- **Fix:** Access `/health` or `/api/v1/...` endpoints

### Issue: App crashes on startup
- **Cause:** Missing .env file or MongoDB connection issue
- **Fix:** 
```bash
# Check logs
pm2 logs scanmate-backend

# Verify .env exists
cat .env

# Test MongoDB connection
```

## Quick Diagnostic Script

Run this on your EC2 instance:

```bash
#!/bin/bash
echo "=== PM2 Status ==="
pm2 status

echo -e "\n=== Port 8000 Check ==="
sudo netstat -tulpn | grep 8000

echo -e "\n=== Firewall Status ==="
sudo ufw status

echo -e "\n=== Local Health Check ==="
curl -s http://localhost:8000/health | head -20

echo -e "\n=== Application Logs (last 10 lines) ==="
pm2 logs scanmate-backend --lines 10 --nostream
```

Save as `check-deployment.sh`, make executable, and run:
```bash
chmod +x check-deployment.sh
./check-deployment.sh
```

## Expected Working URLs

Once everything is configured:

- **Direct access (port 8000):** http://43.204.209.39:8000/health
- **With Nginx (port 80):** http://43.204.209.39/health
- **API endpoint:** http://43.204.209.39:8000/api/v1/...

## Still Not Working?

1. **Check EC2 instance is running** in AWS Console
2. **Verify Public IP** hasn't changed (Elastic IP recommended)
3. **Check application logs:** `pm2 logs scanmate-backend`
4. **Verify MongoDB connection** is working
5. **Test from EC2 itself:** `curl http://localhost:8000/health`

