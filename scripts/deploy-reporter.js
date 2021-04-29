const { exec } = require('child_process');
const fetch = require('node-fetch');

const SLACK_HOOK_URL =
  'https://hooks.slack.com/services/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';

async function cmd(command) {
  return new Promise((res, rej) => {
    exec(command, (error, stdout, stderr) => {
      if (error || stderr) {
        return rej(error || stderr);
      }
      res(stdout);
    });
  });
}

async function main() {
  const releaseHashShort = await cmd('git rev-parse --short HEAD').then(x =>
    x.trim()
  );
  const previousReleaseTag = await cmd(
    'git tag --sort=-creatordate | grep "prod-release" | head -n 2 | tail -n 1'
  ).then(x => x.trim());

  const commits = await cmd(
    `git log --merges --first-parent ${previousReleaseTag}^..HEAD --format="%H"`
  );

  const projectName = await cmd(
    'git remote get-url origin | xargs basename -s .git'
  ).then(x => x.trim());

  const projectUrl = `https://github.com/g-loot/${projectName}`;

  const promises = commits
    .trim()
    .split('\n')
    .map(async hash => {
      const baseRegexp = /Merge pull request \#([0-9]+) from g-loot\/(.+)\|(.+)/;
      const branchRegexp = /((PP)-[0-9]+)/;
      const message = await cmd(`git show -s --format="%s|%b" ${hash}`);
      const [, pullRequest, branchName, description] = message.match(
        baseRegexp
      );
      const ticketUrl = branchName.match(branchRegexp)[1]
        ? `https://gloot.atlassian.net/browse/${
            branchName.match(branchRegexp)[1]
          }`
        : null;
      const prUrl = `https://github.com/g-loot/${projectName}/pull/${pullRequest}`;
      return {
        branchName,
        description,
        prUrl,
        ticketUrl,
        ticketId: branchName.match(branchRegexp)[1],
      };
    });

  const features = await Promise.all(promises);

  const message = generateSlackMsg({
    features,
    version: releaseHashShort,
    projectUrl,
    projectName,
    date: new Date().toISOString().slice(0, 10),
  });

  const body = message;
  console.log(JSON.stringify(message));

  const res = await fetch(SLACK_HOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log(res);
}
main();

function generateSlackMsg({
  features,
  version,
  projectUrl,
  projectName,
  date,
}) {
  const symbols = ['♠️', '♥️', '♣️', '♦️'];
  const baseMsg = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${projectUrl}|${projectName}> just released a new version \`${version}\` \n *Date:* ${date}`,
        },
      },
      {
        type: 'divider',
      },
    ],
  };
  features.forEach(
    ({ branchName, description, prUrl, ticketUrl, ticketId }, i) => {
      const symbol = symbols[i % 4];
      const msg = {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${symbol} <${ticketUrl}|${ticketId}> ${description}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Pull request',
            emoji: true,
          },
          value: 'click_me_123',
          url: prUrl,
          action_id: 'button-action',
        },
      };
      baseMsg.blocks.push(msg);
    }
  );
  return baseMsg;
}
