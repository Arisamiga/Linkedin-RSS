const core = require("@actions/core");
const RSSParser = require("rss-parser");
const https = require("https");

// ---------------------------------------------------------------------------------------------------------------------
// Generic Node.js API to post on LinkedIn
// ---------------------------------------------------------------------------------------------------------------------
const accessToken = core.getInput("ln_access_token");
const feed_list = core.getInput("feed_list");
const embed_images = core.getInput("embed_image");

// Get LinkedIn ID, i.e. ownerId
function getLinkedinId(accessToken) {
  return new Promise((res, rej) => {
    let hostname = "api.linkedin.com";
    let path = "/v2/me";
    let method = "GET";
    let headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    let body = "";
    _request(method, hostname, path, headers, body)
      .then((r) => {
        res(JSON.parse(r.body).id);
      })
      .catch((e) => rej(e));
  });
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
  return new Promise((res, rej) => {
    let hostname = "api.linkedin.com";
    let path = "/v2/shares";
    let method = "POST";
    let body = {
      owner: "urn:li:person:" + ownerId,
      subject: title,
      text: {
        text: text, // max 1300 characters
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
        title: title,
      },
      distribution: {
        linkedInDistributionTarget: {},
      },
    };
    let headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      "x-li-format": "json",
      "Content-Length": Buffer.byteLength(JSON.stringify(body)),
    };
    _request(method, hostname, path, headers, JSON.stringify(body))
      .then((r) => {
        res(r);
      })
      .catch((e) => rej(e));
  });
}

// Generic HTTP requester
function _request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    let reqOpts = {
      method,
      hostname,
      path,
      headers,
      rejectUnauthorized: false, // WARNING: accepting unauthorised end points for testing ONLY
    };
    let resBody = "";
    let req = https.request(reqOpts, (res) => {
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
        postShare(
          accessToken,
          ownerId,
          feed.title,
          feed.items[0].title,
          feed.items[0].link,
          embed_images ?? feed.items[0].link
        )
          .then((r) => {
            console.log(r); // status 201 signal successful posting
            if (r.status != 201) {
              core.setFailed("Failed to post on LinkedIn");
            }
          })
          .catch((e) => console.log(e));
      })
      .catch((e) => console.log(e));
    console.log(
      `${feed.items[0].title} - ${feed.items[0].link}\n${feed.items[0].contentSnippet}\n\n`
    );
  };

  console.log("Parsing " + feed_list);

  parse(feed_list);
} catch (error) {
  core.setFailed(error.message);
}
