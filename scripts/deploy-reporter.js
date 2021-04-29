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
  const test = await cmd(
    'git log --merges --first-parent prod-release^..HEAD --format="%H"'
  );
  console.log(test);
}

main();
