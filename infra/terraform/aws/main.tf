data "aws_availability_zones" "current" {
  state = "available"
}

data "aws_iam_policy_document" "eks_cluster_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "eks_node_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

locals {
  name_prefix    = "${var.namespace}-${var.environment}"
  az_pool        = length(var.availability_zones) > 0 ? var.availability_zones : data.aws_availability_zones.current.names
  public_azs     = slice(local.az_pool, 0, min(length(local.az_pool), var.public_subnet_count))
  private_azs    = slice(local.az_pool, 0, min(length(local.az_pool), var.private_subnet_count))
  postgres_pwd   = var.postgres_password != null && var.postgres_password != "" ? var.postgres_password : random_password.postgres.result
  node_subnet_ids = length(aws_subnet.private) > 0 ? aws_subnet.private[*].id : aws_subnet.public[*].id
  subnet_count    = {
    public  = length(local.public_azs)
    private = length(local.private_azs)
  }
  common_tags = merge(
    {
      Project     = var.namespace
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

resource "random_password" "postgres" {
  length  = 24
  special = false
}

resource "random_id" "evidence_bucket" {
  byte_length = 4
}

resource "aws_kms_key" "platform" {
  description             = "KMS key for Portarium runtime control-plane secrets and Evidence Artifacts"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "platform" {
  name          = "alias/${local.name_prefix}-platform"
  target_key_id = aws_kms_key.platform.key_id
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "${local.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count                   = local.subnet_count.public
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = local.public_azs[count.index]
  map_public_ip_on_launch = true
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-public-${count.index + 1}"
      Tier = "public"
    },
  )
}

resource "aws_subnet" "private" {
  count             = local.subnet_count.private
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 50)
  availability_zone = local.private_azs[count.index]
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-private-${count.index + 1}"
      Tier = "private"
    },
  )
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = local.subnet_count.public
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = local.subnet_count.private > 0 ? 1 : 0
  domain = "vpc"
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-nat" })
}

resource "aws_nat_gateway" "main" {
  count         = local.subnet_count.private > 0 ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-nat" })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count  = local.subnet_count.private > 0 ? 1 : 0
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-private-rt" })
}

resource "aws_route" "private_nat" {
  count                  = local.subnet_count.private > 0 ? 1 : 0
  route_table_id         = aws_route_table.private[0].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}

resource "aws_route_table_association" "private" {
  count          = local.subnet_count.private
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_security_group" "eks_cluster" {
  name        = "${local.name_prefix}-eks-cluster"
  description = "Portarium EKS control-plane security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-eks-cluster-sg" })
}

resource "aws_security_group" "eks_nodes" {
  name        = "${local.name_prefix}-eks-nodes"
  description = "Portarium EKS worker security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-eks-node-sg" })
}

resource "aws_security_group" "postgres" {
  name        = "${local.name_prefix}-postgres"
  description = "PostgreSQL database security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-postgres-sg" })
}

resource "aws_iam_role" "eks_cluster" {
  name               = "${local.name_prefix}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_service_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
}

resource "aws_iam_role" "eks_nodes" {
  name               = "${local.name_prefix}-eks-node-role"
  assume_role_policy = data.aws_iam_policy_document.eks_node_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_node_worker" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_node_cni" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_node_container_registry" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "eks_node_ssm" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_eks_cluster" "platform" {
  name     = local.name_prefix
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.eks_cluster_version

  vpc_config {
    subnet_ids         = local.node_subnet_ids
    security_group_ids  = [aws_security_group.eks_cluster.id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_service_policy,
    aws_security_group.eks_cluster,
  ]
}

resource "aws_eks_node_group" "execution" {
  cluster_name    = aws_eks_cluster.platform.name
  node_group_name = "${local.name_prefix}-execution"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = local.node_subnet_ids

  scaling_config {
    desired_size = var.eks_node_desired_size
    min_size     = var.eks_node_min_size
    max_size     = var.eks_node_max_size
  }

  instance_types = var.eks_node_instance_types

  disk_size      = 50
  capacity_type  = "ON_DEMAND"
  ami_type       = "AL2_x86_64"
  force_update_version = true

  labels = {
    "app.kubernetes.io/part-of" = "portarium"
  }

  depends_on = [
    aws_eks_cluster.platform,
    aws_security_group.eks_nodes
  ]
}

resource "aws_db_subnet_group" "runtime" {
  name       = "${local.name_prefix}-postgres-subnet-group"
  subnet_ids = local.node_subnet_ids

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-postgres-subnet-group" })
}

resource "aws_db_instance" "runtime" {
  identifier                = "${local.name_prefix}-runtime"
  engine                    = "postgres"
  engine_version            = var.postgres_engine_version
  instance_class            = var.postgres_instance_class
  allocated_storage         = var.postgres_allocated_storage
  storage_type              = "gp3"
  storage_encrypted         = true
  kms_key_id                = aws_kms_key.platform.arn
  db_name                   = var.postgres_db_name
  username                  = var.postgres_username
  password                  = local.postgres_pwd
  skip_final_snapshot       = true
  multi_az                  = var.postgres_multi_az
  db_subnet_group_name      = aws_db_subnet_group.runtime.name
  vpc_security_group_ids    = [aws_security_group.postgres.id]
  backup_retention_period   = var.postgres_backup_retention_days
  maintenance_window        = "Mon:04:00-Mon:05:00"
  deletion_protection       = var.postgres_deletion_protection
  copy_tags_to_snapshot     = true
  auto_minor_version_upgrade = true
  publicly_accessible       = false
  apply_immediately         = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-runtime-postgres" })
}

resource "aws_s3_bucket" "evidence_store" {
  bucket = "${local.name_prefix}-${var.evidence_bucket_name}-${random_id.evidence_bucket.hex}"
  force_destroy = false
  object_lock_enabled = var.enable_evidence_object_lock
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-evidence-store" })
}

resource "aws_s3_bucket_versioning" "evidence_store" {
  bucket = aws_s3_bucket.evidence_store.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_store" {
  bucket = aws_s3_bucket.evidence_store.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
      kms_master_key_id = aws_kms_key.platform.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "evidence_store" {
  bucket                  = aws_s3_bucket.evidence_store.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "evidence_store" {
  bucket = aws_s3_bucket.evidence_store.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "evidence_store" {
  count  = var.enable_evidence_object_lock ? 1 : 0
  bucket = aws_s3_bucket.evidence_store.id

  rule {
    default_retention {
      mode  = var.evidence_lock_mode
      days  = var.evidence_lock_days
    }
  }

  depends_on = [
    aws_s3_bucket_versioning.evidence_store
  ]
}
