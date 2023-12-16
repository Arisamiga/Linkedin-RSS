const core = require("@actions/core");
const RSSParser = require("rss-parser");
const https = require("https");

// ---------------------------------------------------------------------------------------------------------------------
// Generic Node.js API to post on LinkedIn
// ---------------------------------------------------------------------------------------------------------------------
const accessToken = core.getInput("ln_access_token");
const feedList = core.getInput("feed_list");
const embedImage = core.getInput("embed_image");
const lastPostPath = core.getInput("last_post_path");

const commitUser = core.getInput("commit_user");
const commitEmail = core.getInput("commit_email");
const commitMessage = core.getInput("commit_message");

// Get LinkedIn ID, i.e. ownerId
function getLinkedinId(accessToken) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/v2/userinfo";
    const method = "GET";
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const body = "";
    _request(method, hostname, path, headers, body)
      .then((r) => {
        // Check if sub has anything or else call /v2/me
        if (JSON.parse(r.body).sub) return resolve(JSON.parse(r.body).sub);
        // If sub is empty, call /v2/me
        const hostname = "api.linkedin.com";
        const path = "/v2/me";
        const method = "GET";

        _request(method, hostname, path, headers, body)
          .then((r) => {
            resolve(JSON.parse(r.body).id);
          })
          .catch((e) => reject(e));
      })
      .catch((e) => reject(e));
  });
}

// Check if post has already been published
function wasPostPublished(feed) {
  // Read .lastPost file in .github/workflows/ to check if the post has been posted
  const fs = require("fs");
  const path = require("path");
  const lastPost = path.join(process.env.GITHUB_WORKSPACE, lastPostPath);

  let lastPostContent = "";
  try {
    lastPostContent = fs.readFileSync(lastPost, "utf8");
  } catch (e) {
    console.log("No .lastPost.txt file found");
  }
  // If the post has been posted, skip
  if (lastPostContent === feed.items[0].link) {
    console.log("Post already posted");
    return true;
  }
  // If the post has not been posted, post
  fs.writeFileSync(lastPost, feed.items[0].link);

  return false;
}

function pushPastFile() {
  // push the file changes to repository
  const { exec } = require("child_process");

  exec("git config --global user.email " + commitEmail);

  exec("git config --global user.name " + commitUser);

  exec("git add .");

  exec("git commit -m '" + commitMessage + "'");

  exec("git push");
}

// Publish content on LinkedIn
function postShare(
  accessToken,
  ownerId,
  title,
  text,
  shareUrl,
  shareThumbnailUrl
) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/v2/shares";
    const method = "POST";
    const body = {
      owner: "urn:li:person:" + ownerId,
      subject: title,
      text: {
        text, // max 1300 characters
      },
      content: {
        contentEntities: [
          {
            entityLocation: shareUrl,
            thumbnails: [
              {
                resolvedUrl: shareThumbnailUrl,
              },
            ],
          },
        ],
        title,
      },
      distribution: {
        linkedInDistributionTarget: {},
      },
    };
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      "x-li-format": "json",
      "Content-Length": Buffer.byteLength(JSON.stringify(body)),
    };
    _request(method, hostname, path, headers, JSON.stringify(body))
      .then((r) => {
        resolve(r);
      })
      .catch((e) => reject(e));
  });
}

// Generic HTTP requester
function _request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const reqOpts = {
      method,
      hostname,
      path,
      headers,
      rejectUnauthorized: false, // WARNING: accepting unauthorised end points for testing ONLY
    };
    let resBody = "";
    const req = https.request(reqOpts, (res) => {
      res.on("data", (data) => {
        resBody += data.toString("utf8");
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: resBody,
        });
      });
    });
    req.on("error", (e) => {
      reject(e);
    });
    if (method !== "GET") {
      req.write(body);
    }
    req.end();
  });
}

try {
  const parse = async (url) => {
    const feed = await new RSSParser().parseURL(url);

    console.log(feed.title);
    getLinkedinId(accessToken)
      .then((ownerId) => {
        const pastPostCheck = wasPostPublished(feed);
        if (pastPostCheck) {
          core.warning("Post was already published");
          core.warning("Ending job because post was already published");
          return;
        }

        postShare(
          accessToken,
          ownerId,
          feed.title,
          feed.items[0].title,
          feed.items[0].link,
          embedImage ?? feed.items[0].link
        )
          .then((r) => {
            console.log(r); // status 201 signal successful posting
            if (r.status === 401) {
              core.setFailed(
                "Failed to post on LinkedIn, please check your access token is valid"
              );
            } else if (r.status !== 201) {
              core.setFailed("Failed to post on LinkedIn");
            }
            if (!pastPostCheck) {
              pushPastFile();
            }
          })
          .catch((e) => console.log(e));
      })
      .catch((e) => console.log(e));
    console.log(
      `${feed.items[0].title} - ${feed.items[0].link}\n${feed.items[0].contentSnippet}\n\n`
    );
  };

  console.log("Parsing " + feedList);

  parse(feedList);
} catch (error) {
  core.setFailed(error.message);
}
