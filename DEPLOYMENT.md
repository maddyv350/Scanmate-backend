# AWS EC2 Deployment Guide for Scanmate Backend

This guide will walk you through deploying your Node.js backend application to AWS EC2.

## Prerequisites

1. AWS EC2 instance running Ubuntu (20.04 LTS or 22.04 LTS recommended)
2. SSH access to your EC2 instance
3. MongoDB database (MongoDB Atlas or self-hosted)
4. Your application code ready to deploy

## Step 1: Connect to Your EC2 Instance

```bash
# Replace with your EC2 instance details
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip
```

## Step 2: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

## Step 3: Install Node.js and npm

```bash
# Install Node.js 18.x (LTS version)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 4: Install MongoDB (if self-hosting)

If you're using MongoDB Atlas, skip this step.

```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
```

## Step 5: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

## Step 6: Install Git (if not already installed)

```bash
sudo apt install -y git
```

## Step 7: Clone or Upload Your Code

### Option A: Using Git (Recommended)

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/your-username/scanmate-backend.git
cd scanmate-backend
```

### Option B: Using SCP (from your local machine)

From your local terminal (not on EC2):

```bash
# Upload your code to EC2
scp -i /path/to/your-key.pem -r /path/to/scanmate-backend ubuntu@your-ec2-public-ip:~/
```

Then on EC2:

```bash
cd ~/scanmate-backend
```

## Step 8: Install Dependencies

```bash
# Install project dependencies
npm install
```

## Step 9: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add the following environment variables (adjust values as needed):

```env
NODE_ENV=production
PORT=8000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret-key
# Add any other environment variables your app needs
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 10: Configure Security Group (AWS Console)

1. Go to AWS EC2 Console
2. Select your instance
3. Click on Security tab
4. Click on Security Group
5. Edit Inbound Rules:
   - Add rule: Type: Custom TCP, Port: 8000, Source: 0.0.0.0/0 (or your specific IP)
   - Add rule: Type: SSH, Port: 22, Source: Your IP (for security)

## Step 11: Start Application with PM2

```bash
# Start the application
pm2 start server.js --name scanmate-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup
# Run the command that PM2 outputs (it will be something like: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu)
```

## Step 12: Configure Nginx as Reverse Proxy (Optional but Recommended)

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/scanmate-backend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or EC2 public IP

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

Save and exit, then:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/scanmate-backend /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 13: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically renew certificates
```

## Step 14: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs scanmate-backend

# Check if application is running
curl http://localhost:8000/health

# If using Nginx, test from outside
curl http://your-ec2-public-ip/health
```

## Useful PM2 Commands

```bash
# View logs
pm2 logs scanmate-backend

# Restart application
pm2 restart scanmate-backend

# Stop application
pm2 stop scanmate-backend

# Delete application from PM2
pm2 delete scanmate-backend

# Monitor application
pm2 monit
```

## Troubleshooting

### Application not starting
```bash
# Check PM2 logs
pm2 logs scanmate-backend --lines 50

# Check if port is in use
sudo netstat -tulpn | grep 8000
```

### MongoDB connection issues
```bash
# Test MongoDB connection
mongo your-mongodb-uri

# Check MongoDB service (if self-hosted)
sudo systemctl status mongod
```

### Firewall issues
```bash
# Check if ufw is blocking ports
sudo ufw status

# Allow port 8000 (if needed)
sudo ufw allow 8000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Quick Deployment Script

You can also create a deployment script. Create `deploy.sh`:

```bash
#!/bin/bash
cd ~/scanmate-backend
git pull origin main  # or your branch name
npm install
pm2 restart scanmate-backend
```

Make it executable:
```bash
chmod +x deploy.sh
```

Run it:
```bash
./deploy.sh
```

## Notes

- Replace `your-ec2-public-ip` with your actual EC2 instance public IP
- Replace `your-domain.com` with your actual domain (if using)
- Make sure your MongoDB connection string is correct
- Keep your `.env` file secure and never commit it to Git
- Consider using AWS Secrets Manager for production environment variables
- Monitor your application logs regularly
- Set up CloudWatch for monitoring and logging

