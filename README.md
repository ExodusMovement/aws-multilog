## aws multi-role log viewer

### description

Uses AWS CloudWatch Insights to query multiple log groups across multiple STS roles in parallel, and then combines and sorts them all by timestamp. The default query it uses is `fields @message, @timestamp` in the last 5 minutes

### installation

```
npm i @exodus/aws-multilog -g
```

Requirements: 

Install `pip install qaws`, `pip install awsume`

Then configure your amazon config including mfa_token and source_profile for all roles...

For example in my `~/.aws/config` I have 

```
[profile staging]
region = us-east-1
output = json
mfa_serial     = arn:aws:iam::myuserid:mfa/myusername

[profile staging-myrole]
source_profile = staging
role_arn       = arn:aws:iam::accountid:role/rolename
```

and in `~/.aws/credentials` I have:

```
[staging]
aws_access_key_id = myid
aws_secret_access_key = mykey
```

if you have `mfa_serial` specified then make sure you do `awsume staging` (or whatever your role is) to ensure your mfa token is cached and working

### configuration

Create the file `~/.aws/multilog.json` to hold your log group configuration:

```
[
  {
    "profile": "staging",
    "groups": [
      "/aws/lambda/staging-lambda",
      "/aws/lambda/database-lambda"
    ],
    "color": "blue"
  },
  {
    "profile": "production",
    "groups": [
      "/aws/lambda/production-lambda"
    ],
    "color": "blueBright"
  }
]
```

### usage

```
$ aws-multilog
# defaults to 5 minutes, queries all messages

$ aws-multilog 1h
# all messages in last hour

$ aws-multilog --query "fields @message, @timestamp | filter level = "error"'
# only get log level error (assuming your logs are json w/ "level": "error")
```

#### options

- `-q` - quiet mode
- `--time` - specify custom time, i.e. 5m or 1h
- `--json` - ndjson outpout 
- `--query` - specify custom insights query string
