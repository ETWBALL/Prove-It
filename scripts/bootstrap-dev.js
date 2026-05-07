const { spawn } = require('child_process')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })

    child.on('error', reject)
  })
}

async function main() {
  try {
    await run('pnpm', ['install', '--force'])
    await run('pnpm', ['--filter', '@prove-it/db', 'run', 'generate'])
    await run('pnpm', ['--filter', '@prove-it/db', 'run', 'seed'])
    await run('pnpm', ['run', 'dev'])
  } catch (error) {
    console.error('\nBootstrap failed.')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
