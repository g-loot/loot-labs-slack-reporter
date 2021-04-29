const { exec } = require('child_process');

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
  const commits = await cmd(
    'git log --merges --first-parent prod-release^..HEAD --format="%H"'
  );

  const promises = commits
    .trim()
    .split('\n')
    .map(async hash => {
      const baseRegexp = /Merge pull request \#([0-9]+) from g-loot\/(.+)\|(.+)/;
      const branchRegexp = /((PP)-[0-9]+)/;
      const message = await cmd(`git show -s --format="%s|%b" ${hash}`);
      const [, pullRequest, branchName, commitBody] = message.match(baseRegexp);
      const ticketUrl = branchName.match(branchRegexp)[1]
        ? `https://gloot.atlassian.net/browse/${
            branchName.match(branchRegexp)[1]
          }`
        : null;
      const prUrl = `https://github.com/g-loot/youbet-gae/pull/${pullRequest}`;
      return `${branchName}, ${commitBody}, ${prUrl}, ${ticketUrl}`;
    });

  const messages = await Promise.all(promises);

  console.log(messages);
}
main();
