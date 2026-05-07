const { execSync } = require('child_process')

function run(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

function killOnWindows(port) {
  const output = run(`netstat -ano -p tcp | findstr :${port}`)
  if (!output) return

  const pids = new Set()
  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const localAddress = parts[1] || ''
    const state = (parts[3] || '').toUpperCase()
    const pid = parts[4]

    if (!localAddress.endsWith(`:${port}`)) continue
    if (state !== 'LISTENING') continue
    if (!pid || pid === '0') continue
    pids.add(pid)
  }

  for (const pid of pids) {
    run(`taskkill /F /PID ${pid}`)
  }
}

function killOnUnix(port) {
  const output = run(`lsof -ti tcp:${port}`)
  if (!output) return

  const pids = new Set(output.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
  for (const pid of pids) {
    run(`kill -9 ${pid}`)
  }
}

function main() {
  const port = 3001
  if (process.platform === 'win32') {
    killOnWindows(port)
    return
  }
  killOnUnix(port)
}

main()
