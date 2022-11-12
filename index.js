const core = require('@actions/core');
const github = require('@actions/github');
const RSSParser = require("rss-parser");

try {
    const parse = async url => {
        const feed = await new RSSParser().parseURL(url);

        console.log(feed.title);
        console.log(`${feed.items[0].title} - ${feed.items[0].link}\n${feed.items[0].contentSnippet}\n\n`);
    };
  // `who-to-greet` input defined in action metadata file
  const feed_list = core.getInput('feed_list');;
  console.log("Parsing " + feed_list);

  parse(feed_list);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}