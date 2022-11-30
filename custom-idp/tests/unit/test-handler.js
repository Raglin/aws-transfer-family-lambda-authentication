'use strict';

const fs = require('fs');
const chai = require('chai');
const rewire = require("rewire");
const { mockClient } = require("aws-sdk-client-mock");
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3MockClient = mockClient(S3Client);

const expect = chai.expect;
var context;

describe('Authorize Function', function () {
    beforeEach(function () {
        // required env variables
        process.env.HOME_DIRECTORY_NAME = "dummDirectory";
        process.env.S3_ACCESS_ROLE_ARN = "dummyRole"
        process.env.S3_ROOT_BUCKET_ARN = "dummyBucket"
        process.env.ACTIVE_DIRECTORY_URL = "ldap://dummy";
        process.env.ACTIVE_DIRECTORY_BASE_DN = "dc=dummy,dc=com";
        s3MockClient.reset();
    })

    afterEach(function() {

    })

    it('verfies authroize response for a valid login', async () => {
        let app = rewire("../../src/app.js");

        // mock out s3 commands
        s3MockClient.on(ListObjectsV2Command).resolves({
            KeyCount: 1
        });

        // mock activedirectory
        class ActiveDirectoryMock {
            constructor(url, baseDN, username, password, defaults) {
                // dummy constructor, should test for handling connection failures.
            }

            authenticate(username, password, callback) {
                // mock method to authenticate, this passes authentication
                callback(null, true);
            }

            findUser(loginName, callback) {
                callback(null, { sAMAccountName: "user" });
            }
        }
        app.__set__("ActiveDirectory", ActiveDirectoryMock);


        let request_data = JSON.parse(fs.readFileSync(__dirname + '/../events/pass/request.json', 'utf8'));
        let result = await app.authorize(request_data, context);

        expect(result.Role).to.equal('dummyRole');
        expect(result.HomeDirectory).to.equal('/dummDirectory/user');
        expect(result.userName).to.equal('user');
        expect(result.Policy).to.not.be.empty;

        let policy = JSON.parse(result.Policy).Statement;
        expect(policy.filter(e => e.Sid == 'VisualEditor1')[0].Resource).to.equal('dummyBucket/user*')
    });

    it('verfies authroize response for a failed login', async () => {
        let app = rewire("../../src/app.js");

        // mock out s3 commands
        s3MockClient.on(ListObjectsV2Command).resolves({
            KeyCount: 0
        });

        // mock activedirectory
        class ActiveDirectoryMock {
            constructor(url, baseDN, username, password, defaults) {
                // dummy constructor, should test for handling connection failures.
            }

            authenticate(username, password, callback) {
                // mock method to authenticate, this passes authentication
                callback("username or password incorrect", false);
            }

            findUser(loginName, callback) {
                callback("username or password incorrect", {  });
            }
        }
        app.__set__("ActiveDirectory", ActiveDirectoryMock);


        let request_data = JSON.parse(fs.readFileSync(__dirname + '/../events/fail/request.json', 'utf8'));
        let result = await app.authorize(request_data, context);

        expect(result).to.be.empty;
    });

});
