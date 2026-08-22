import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  cwd: process.cwd(),
  env: process.env,
  shell: true
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  if (output.includes('❯')) {
    child.stdin.write('\r\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code);
});
