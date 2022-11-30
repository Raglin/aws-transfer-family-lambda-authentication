# transfer-custom-identity-provider

This project contains source code and supporting files for deploying an FTP/FTPs solution with custom authentication to Active Directory using AWS Transfer Family and Lambda. 

## Prerequistes
- VPC with relevant subnets. At minimum 1 subnet must be provided.
- A certificate ARN from AWS Certificate Manager. This parameter is optional, and only required for FTPS deployment
- Active Directory LDAP URL, and the appropriate Base DN

## Project details
The application creates serveral resources, these are
- S3 Bucket, the home directory for AWS Transfer Family
- AWS Transfer Family instance, deployed in the specified subnets/vpc
  - IAM Role for AWS Transfer Family, with policies to log to CloudWatch for AWS Transfer Family
  - IAM Role for AWS Transfer Family, with policies to get/put/delete objects to S3
  - Security Group with access on relevant ingress 
    - Ingress ports, all IP, ports 21, 8192-8200
    - Egress ports, all traffic
  - AWS Lambda function, hosting the authentication and authorization functionality to the pre-existing Active Directory
    - Execution role for Lambda, and policies to S3 to list/create objects
    - Permissions for AWS Transfer to invoke Lambda
    - Security group for Lambda

## Build project

The project is built using yarn, and minimized with webpack.

To build, run the following within the .\custom-idp directory
``` 
yarn install
yarn build
```

The deployable disribution is
```
.\custom-idp\dist\app.js
```

## Deploy the application

To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* Node.js - [Install Node.js 16](https://nodejs.org/en/), including the NPM package management tool.

To build and deploy your application for the first time, run the following in your shell:

```bash
sam build
sam deploy --guided
```

The first command will build the source of your application. The second command will package and deploy your application to AWS, with a series of prompts:

* **Stack Name**: The name of the stack to deploy to CloudFormation. This should be unique to your account and region, and a good starting point would be something matching your project name.
* **AWS Region**: The AWS region you want to deploy your app to.
* **HomeDirectoryName**:
* **VpcId**: VPC where the solution will be deployed to
* **SubnetId1**: Subnet to deploy Lambda and AWS Transfer Family
* **SubnetId2**: Additional subnet for multi-az approach, optional
* **SubnetId3**: Additional subnet for multi-az approach, optional
* **CertificateArn**: ARN for the certificate to be used when FTPS is needed
* **ActiveDirectoryUrl**: URL to LDAP for user authentication, format ldap://
* **ActiveDirectoryBaseDN**: Starting point used when searching for users authentication within your Directory, format is typicall dc=??,dc=??
* **Confirm changes before deploy**: If set to yes, any change sets will be shown to you before execution for manual review. If set to no, the AWS SAM CLI will automatically deploy application changes.
* **Allow SAM CLI IAM role creation**: Many AWS SAM templates, including this example, create AWS IAM roles required for the AWS Lambda function(s) included to access AWS services. By default, these are scoped down to minimum required permissions. To deploy an AWS CloudFormation stack which creates or modifies IAM roles, the `CAPABILITY_IAM` value for `capabilities` must be provided. If permission isn't provided through this prompt, to deploy this example you must explicitly pass `--capabilities CAPABILITY_IAM` to the `sam deploy` command.
* **Save arguments to samconfig.toml**: If set to yes, your choices will be saved to a configuration file inside the project, so that in the future you can just re-run `sam deploy` without parameters to deploy changes to your application.

Please view the VPC Endpoint to find the server connection URL