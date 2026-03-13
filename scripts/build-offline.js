#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-offline',
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

run('npm', ['run', 'build'])
run('node', ['scripts/package-standalone.js'])
