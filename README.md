# Linkedin-RSS
Post the latest post from your RSS Feed to your LinkedIn Profile

<a href="https://github.com/Arisamiga/Linkedin-RSS/issues">
 <img alt="Issues" src="https://img.shields.io/github/issues/Arisamiga/Linkedin-RSS?color=0088ff" />
</a>

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/3745df43ebbe497990648d06ea0cd2fa)](https://app.codacy.com/gh/Arisamiga/Linkedin-RSS/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

## How to use

1.  Create a folder named .github and create a workflows folder inside it, if it doesn't exist.

2.  Create a new .yml file with the following contents inside the workflows folder:

```yaml
name: Linkedin blog post workflow
on:
  schedule: # Run workflow automatically
    - cron: '0 * * * *' # Runs every hour, on the hour
  workflow_dispatch: # Run workflow manually (without waiting for the cron to be called), through the GitHub Actions Workflow page directly
  
jobs:
  linkedin_rss_job:
    runs-on: ubuntu-latest
    name: Post Latest RSS Post to Linkedin
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Get Latest Post / Post On Linkedin
        uses: Arisamiga/Linkedin-RSS@master
        with:
          feed_list: # Url of RSS
          ln_access_token: # Url of LinkedIn Access Token
          embed_image: # Url of embed image
```
Add on the above `feed_list` your own RSS feed URL.

Add on the above `ln_access_token` your LinkedIn Access Token.

(Optional) Add a url of a image on `embed_image` that you would like to use as a image in your embed

## How to get your LinkedIn Access Token

Register the app in [LinkedIn Developer Network](https://developer.linkedin.com/)

+   Go to LinkedIn Developer Network and create an app;
+   Select `Test University` or `PersonalDev` can be used as the company associated with the app without verification;

#

+   Once you made your Application go to your App and go to "Products"
+   From there Select "Share on LinkedIn" and "Sign In with LinkedIn" and "Request Access" For both of them


#

+   Once you have added your Products go to https://www.linkedin.com/developers/tools/oauth/
+   Select "Create a new access token" and click "Create Token" Select your app and make sure you have the `r_liteprofile`, `w_member_social` scopes selected.
+   Press "Request Access Token" and you will be asked to login. After Successfully logging in you will be given your Access Token.

# Notices

> **I suggest for your ln_access_token you use a Github Secret. (Whats a Github Secret check here https://docs.github.com/en/actions/security-guides/encrypted-secrets)**


> Thanks to https://github.com/gfiocco/linkedin-node-api as the LinkedIn Docs are wierd..

## Code and bug reporting
You can open a issue at https://github.com/Arisamiga/Linkedin-RSS
