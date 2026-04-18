import { spawn } from "node:child_process";
const tasks = [
  [process.execPath, ["scripts/prisma-runner.mjs", "generate"]],
  [process.execPath, ["scripts/bootstrap-db-runner.mjs"]],
  [process.execPath, ["scripts/prisma-runner.mjs", "db", "seed"]]
];

for (const [command, args] of tasks) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject(new Error(`Falha ao executar ${command} ${args.join(" ")}`));
      }
    });
  });
}
