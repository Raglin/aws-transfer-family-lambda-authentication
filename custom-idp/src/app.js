const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
var s3Client = new S3Client({apiVersion: '2006-03-01'});

let ActiveDirectory = require('activedirectory');

let transferHomeDirectory = "/" + process.env.HOME_DIRECTORY_NAME; // Home directory for users logged in users. A subdirect
let transferS3Role = process.env.S3_ACCESS_ROLE_ARN
let transferS3ServerBucket = process.env.S3_ROOT_BUCKET_ARN; // ARN for S3 Bucket correlating to home directory
let activeDirectoryUrl = process.env.ACTIVE_DIRECTORY_URL;
let baseDN = process.env.ACTIVE_DIRECTORY_BASE_DN;
let lambdaResponse = "";

// username for LDAP will use SAMAccountName from LDAP, for this example. The username can be any preferred value for LDAP. Username will then
// determine which is the home folder, and the necessary sub diretories for the home folder.
// ${transfer:Username} must be replaced with the correct values
// the bucket must exist
let transferScopeDownPolicy = {
    Version: "2012-10-17",
    Statement: [
        {
            Sid: "VisualEditor0",
            Effect: "Allow",
            Action: "s3:ListBucket",
            Resource: transferS3ServerBucket,
            Condition: {
                StringLike: {
                    "s3:prefix": [
                        "${transfer:Username}/*",
                        "${transfer:Username}"
                    ]
                }
            }
        },
        {
            Sid: "VisualEditor1",
            Effect: "Allow",
            Action: [
                "s3:PutObject",
                "s3:GetObjectAcl",
                "s3:GetObject",
                "s3:DeleteObjectVersion",
                "s3:DeleteObject",
                "s3:PutObjectAcl",
                "s3:GetObjectVersion"
            ],
            Resource: transferS3ServerBucket + "/${transfer:Username}*"
        }
    ]
};

let authenticateConfig = {
    url: activeDirectoryUrl,
    baseDN: baseDN
};

const authenticate = async (loginName, loginPassword) => {
    return new Promise(function (resolve, reject) {
        let directory = new ActiveDirectory(authenticateConfig);
        directory.authenticate(loginName, loginPassword, function (err, auth) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve(auth);
            }
        })
    });
}

const getSamAccountName = async (loginName, loginPassword) => {
    return new Promise(function (resolve, reject) {
        let lookupUserConfig = {
            ...authenticateConfig,
            username: loginName,
            password: loginPassword
        }
        let authenticatedDirectory = new ActiveDirectory(lookupUserConfig);
        authenticatedDirectory.findUser(loginName, function (err, user) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log(user);
                resolve(user.sAMAccountName);
            }
        });
    });
}

exports.authorize = async (event, context) => {
    try {
        let username = event.username;
        let password = event.password;
        let login = await authenticate(username, password);
        let accountName;
        if (login) {
            accountName = await getSamAccountName(username, password);

            // set names for policy, ensures access is limited to specified folders, refers to the SAMAccountname for LDAP in this expample
            transferScopeDownPolicy.Statement[0].Condition.StringLike['s3:prefix'][0] = accountName + "/*";
            transferScopeDownPolicy.Statement[0].Condition.StringLike['s3:prefix'][1] = accountName;
            transferScopeDownPolicy.Statement[0].Condition.StringLike['s3:prefix'][1] = accountName;
            transferScopeDownPolicy.Statement[1].Resource = transferS3ServerBucket + "/" + accountName + "*";
            // check if "folder" exists in home directory
            let listObjectParam = {
                Bucket: process.env.HOME_DIRECTORY_NAME,
                Prefix: accountName + "/",
                MaxKeys: 1
            }
            let accountFolder = await s3Client.send(new ListObjectsV2Command(listObjectParam));

            if (accountFolder.KeyCount == 0) {
                // "folder" does not exist, create it.
                let createFolderParams = {
                    Bucket: process.env.HOME_DIRECTORY_NAME,
                    Key: accountName + "/"
                  };
                await s3Client.send(new PutObjectCommand(createFolderParams));
            }

            lambdaResponse = {                
                Role: transferS3Role,
                Policy: JSON.stringify(transferScopeDownPolicy),
                HomeDirectory: transferHomeDirectory + "/" + accountName,
                userName: accountName
            }

        } else {
            // cannot login in
            console.log("authentication failed for " + username);
            lambdaResponse = {};
        }


    } catch (err) {
        console.log(err);
        lambdaResponse = {};
    }
    
    return lambdaResponse;
};
