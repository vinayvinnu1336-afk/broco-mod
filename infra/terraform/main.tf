# BroCo Mod Cloud Infrastructure (Terraform Scaffold)
# Target: Production-ready Managed PostgreSQL (PostGIS enabled) and Managed Redis

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (staging, production)"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.0.0.0/16"
}

# Future resources: VPC, EKS Cluster, RDS PostgreSQL with PostGIS, ElastiCache Redis
