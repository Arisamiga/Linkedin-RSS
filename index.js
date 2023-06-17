const core = require("@actions/core");
const RSSParser = require("rss-parser");
const https = require("https");

// ---------------------------------------------------------------------------------------------------------------------
// Generic Node.js API to post on LinkedIn
// ---------------------------------------------------------------------------------------------------------------------
const accessToken = core.getInput("ln_access_token");
const feedList = core.getInput("feed_list");
const embedImage = core.getInput("embed_image");

// Get LinkedIn ID, i.e. ownerId
function getLinkedinId(accessToken) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/v2/me";
    const method = "GET";
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const body = "";
    _request(method, hostname, path, headers, body)
      .then((r) => {
        resolve(JSON.parse(r.body).id);
      })
      .catch((e) => reject(e));
  });
}

// Initiate image upload on LinkedIn
function initiateImageUpload(accessToken, ownerId) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/rest/images?action=initializeUpload";
    const method = "POST";
    const body = {
      initializeUploadRequest: {
        owner: "urn:li:person:" + ownerId,
      },
    };
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      "LinkedIn-Version": "202305",
    };
    _request(method, hostname, path, headers, JSON.stringify(body))
      .then((r) => {
        resolve(r);
      })
      .catch((e) => reject(e));
  });
}

// Upload image to LinkedIn
function uploadImageLinkedin(accessToken, image, ownerId) {
  return new Promise((resolve, reject) => {
    initiateImageUpload(accessToken, ownerId)
      .then((r) => {
        const uploadTarget = JSON.parse(r.body).value.uploadUrl;
        const uploadTargetParts = uploadTarget.split("/");
        const hostname = uploadTargetParts[2];
        const path = "/" + uploadTargetParts.slice(3).join("/");

        const imageID = JSON.parse(r.body).value.image;
        const method = "POST";
        const headers = {
          Authorization: "Bearer " + accessToken,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "multipart/form-data",
          "Content-Length": Buffer.byteLength(image),
          "LinkedIn-Version": "202305",
        };

        _request(method, hostname, path, headers, image)
          .then((e) => {
            console.log(e);
            if (e.status !== 201) {
              reject(e);
            }
            console.log("ImgID: " + imageID);
            resolve(imageID);
          })
          .catch((e) => console.log(e));
      })
      .catch((e) => console.log(e));
  });
}

// Get Image from URL
function getUrlImage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// Publish content on LinkedIn
function postShare(
  accessToken,
  ownerId,
  blogTitle,
  text,
  shareUrl,
  shareThumbnailUrl
) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/rest/posts";
    const method = "POST";
    const body = {
      author: "urn:li:person:" + ownerId,
      commentary: text, // max 1300 characters
      contentLandingPage: shareUrl,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    if (shareThumbnailUrl) {
      body.content = {
        media: {
          title: blogTitle,
          altText: "Image",
          id: shareThumbnailUrl,
        },
      };
    }
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      "x-li-format": "json",
      "Content-Length": Buffer.byteLength(JSON.stringify(body)),
      "LinkedIn-Version": "202305",
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
        if (embedImage) {
          getUrlImage(embedImage)
            .then((embedImage) => {
              uploadImageLinkedin(accessToken, embedImage, ownerId)
                .then((imageID) => {
                  if (!imageID) {
                    return core.setFailed(
                      "Failed to upload image to LinkedIn: No image ID returned"
                    );
                  }
                  if (!imageID.startsWith("urn:")) {
                    return core.setFailed(
                      "Failed to upload image to LinkedIn: Image doesn't start with urn:"
                    );
                  }
                  postShare(
                    accessToken,
                    ownerId,
                    feed.title,
                    feed.items[0].title,
                    feed.items[0].link,
                    imageID
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
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            })
            .catch((e) => console.log(e));
          return;
        }
        postShare(
          accessToken,
          ownerId,
          feed.title,
          feed.items[0].title,
          feed.items[0].link
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
