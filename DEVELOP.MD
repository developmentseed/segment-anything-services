# Building a development environment

### Building the container

```sh
docker-compose build
```

### Running the container

```sh
docker-compose up
```

The above CLI will start a Jupyter Notebook, also the iamge can be found in: 


### Upload image to ECR

```sh
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
#aws ecr create-repository --repository-name sam-builder --region us-west-1
aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-1.amazonaws.com/sam-builder
docker tag developmentseed/sam-dev:v1 ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-1.amazonaws.com/sam-builder:develop.v1
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-1.amazonaws.com/sam-builder:develop.v1
```

Image can ge foud there: `${AWS_ACCOUNT_ID}.dkr.ecr.us-west-1.amazonaws.com/sam-builder:develop.v1`









