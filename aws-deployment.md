# AWS Deployment Guide for MuBadges Leaderboard Server

This guide will help you deploy the MuBadges Leaderboard Server to AWS using either EC2 or ECS.

## Option 1: Deploy to AWS EC2

### Prerequisites
- AWS account
- AWS CLI installed and configured
- Basic knowledge of AWS EC2

### Steps

1. **Create an EC2 Instance**

   - Launch an EC2 instance (t2.micro or larger recommended)
   - Select Amazon Linux 2 or Ubuntu Server as the AMI
   - Configure security group to allow inbound traffic on port 3001
   - Create or select an existing key pair for SSH access

2. **Connect to Your EC2 Instance**

   ```bash
   ssh -i your-key.pem ec2-user@your-instance-public-ip
   ```

3. **Install Docker**

   For Amazon Linux 2:
   ```bash
   sudo yum update -y
   sudo amazon-linux-extras install docker -y
   sudo service docker start
   sudo systemctl enable docker
   sudo usermod -a -G docker ec2-user
   ```

   For Ubuntu:
   ```bash
   sudo apt update
   sudo apt install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -a -G docker ubuntu
   ```

   Log out and log back in for the group changes to take effect.

4. **Clone Your Repository**

   ```bash
   git clone <your-repo-url>
   cd MuBadges
   ```

5. **Build and Run Docker Container**

   ```bash
   docker build -t mubadges-leaderboard .
   docker run -d -p 3001:3001 \
     -e ALCHEMY_API_KEY=your_alchemy_key \
     -e API_KEY=your_api_key \
     -e MORALIS_API_KEYS=your_moralis_keys \
     -e REFRESH_SECRET=your_refresh_secret \
     --name mubadges-leaderboard \
     mubadges-leaderboard
   ```

6. **Set Up a Domain (Optional)**

   - Register a domain in Route 53 or use an existing domain
   - Create an A record pointing to your EC2 instance's public IP
   - Consider using Elastic IP to keep a static IP address

7. **Set Up HTTPS (Optional but Recommended)**

   - Install Certbot for Let's Encrypt certificates
   - Set up Nginx as a reverse proxy with SSL termination

## Option 2: Deploy to AWS ECS (Elastic Container Service)

### Prerequisites
- AWS account
- AWS CLI installed and configured
- Docker installed locally

### Steps

1. **Create an ECR Repository**

   ```bash
   aws ecr create-repository --repository-name mubadges-leaderboard
   ```

2. **Build, Tag, and Push Docker Image**

   ```bash
   # Login to ECR
   aws ecr get-login-password --region your-region | docker login --username AWS --password-stdin your-account-id.dkr.ecr.your-region.amazonaws.com

   # Build and tag the image
   docker build -t mubadges-leaderboard .
   docker tag mubadges-leaderboard:latest your-account-id.dkr.ecr.your-region.amazonaws.com/mubadges-leaderboard:latest

   # Push the image
   docker push your-account-id.dkr.ecr.your-region.amazonaws.com/mubadges-leaderboard:latest
   ```

3. **Create ECS Cluster**

   - Go to AWS ECS console
   - Create a new cluster (Fargate or EC2 launch type)
   - Follow the wizard to complete the setup

4. **Create Task Definition**

   - Create a new task definition (Fargate compatible)
   - Add your container with the ECR image URL
   - Configure environment variables (ALCHEMY_API_KEY, API_KEY, etc.)
   - Set port mappings (3001:3001)
   - Configure CPU and memory requirements

5. **Create ECS Service**

   - Create a new service in your cluster
   - Use the task definition you created
   - Configure desired number of tasks (1 is sufficient)
   - Set up load balancer if needed
   - Configure security groups to allow inbound traffic on port 3001

6. **Set Up Application Load Balancer (Optional)**

   - Create an Application Load Balancer
   - Configure listeners for HTTP (port 80) and HTTPS (port 443)
   - Set up target groups pointing to your ECS service
   - Configure health checks

7. **Set Up Domain and HTTPS (Optional)**

   - Register a domain in Route 53 or use an existing domain
   - Create an A record pointing to your load balancer
   - Set up AWS Certificate Manager for SSL/TLS certificates
   - Configure HTTPS listener on your load balancer

## Environment Variables

Make sure to set these environment variables in your deployment:

- `ALCHEMY_API_KEY` - Your Alchemy API key
- `API_KEY` - Your Arena Social Badges API key
- `MORALIS_API_KEYS` - Your Moralis API keys (comma-separated if multiple)
- `LEADERBOARD_SERVER_PORT` - Port for the server (default: 3001)
- `REFRESH_SECRET` - Secret for protecting the refresh endpoint

## Continuous Deployment (Optional)

Consider setting up a CI/CD pipeline using GitHub Actions or AWS CodePipeline to automate deployments whenever you push changes to your repository.

## Monitoring and Logging

- Set up CloudWatch for monitoring and logging
- Configure alarms for high CPU/memory usage
- Set up log groups to capture application logs

## Security Considerations

- Use AWS Secrets Manager to store sensitive environment variables
- Implement proper IAM roles and policies
- Restrict security group rules to only necessary ports
- Enable VPC for network isolation
- Implement rate limiting for public endpoints

## Backup and Recovery

- Set up regular backups of your application state
- Document recovery procedures
- Test recovery processes periodically
