#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const env = {
  ...process.env,
  // Ensure HOST is set for remix-serve to listen on all interfaces
  HOST: process.env.HOST || '0.0.0.0',
  // Limit Node.js memory usage
  NODE_OPTIONS: '--max-old-space-size=512'
}

// Ensure data directory exists
if (!fs.existsSync('/data')) {
  fs.mkdirSync('/data', { recursive: true })
}

// Set database path to the mounted volume
const dbPath = '/data/dev.sqlite'
env.DATABASE_URL = `file:${dbPath}`

console.log(`Database will be stored at: ${dbPath}`)

// Check if database already exists
const dbExists = fs.existsSync(dbPath)
console.log(`Database exists: ${dbExists}`)

try {
  if (dbExists) {
    console.log('Database exists, running Prisma generate only...')
    // Only generate Prisma client if database exists
    await exec('npx prisma generate', { maxBuffer: 1024 * 1024 * 10 }) // 10MB buffer
  } else {
    console.log('Database does not exist, running full migration...')
    // Run migration with memory constraints
    await exec('npx prisma generate', { maxBuffer: 1024 * 1024 * 10 })
    await exec('npx prisma migrate deploy', { maxBuffer: 1024 * 1024 * 10 })
  }

  console.log('Database setup completed successfully')
} catch (error) {
  console.error('Database setup failed:', error)
  // Don't exit completely - try to start the app anyway
  console.log('Attempting to continue with app startup...')
}

// launch application
console.log('Starting application...')
await exec(process.argv.slice(2).join(' '))

function exec(command, options = {}) {
  console.log(`Executing: ${command}`)
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env,
    ...options
  })

  return new Promise((resolve, reject) => {
    let timeoutId = setTimeout(() => {
      console.log(`Command "${command}" timed out after 2 minutes, killing...`)
      child.kill('SIGKILL')
      reject(new Error(`${command} timed out`))
    }, 120000) // 2 minute timeout

    child.on('exit', code => {
      clearTimeout(timeoutId)
      console.log(`Command "${command}" exited with code: ${code}`)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} failed rc=${code}`))
      }
    })

    child.on('error', (error) => {
      clearTimeout(timeoutId)
      console.error(`Command "${command}" error:`, error)
      reject(error)
    })
  })
}
