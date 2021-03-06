#!/usr/bin/env node
const chalk = require("chalk")
const split = require("split2")
const pump = require("pump")
const through = require("through2")
const log = console.log
const child = require("child_process")
const os = require('os')

const config = require(os.homedir() + '/.aws/multilog.json')

var argv = require('minimist')(process.argv.slice(2))

let insightsQuery = argv.query || 'fields @timestamp, @message'
if (argv.filter) insightsQuery += ' | filter ' + argv.filter
if (argv.limit) insightsQuery += ' | limit ' + argv.limit

const time = argv.time || '5m'
const end = argv.end || ''
if (!argv.q) console.error('Querying logs for time window', time + (end ? ' ' + end : ''), 'with query:', insightsQuery)

const results = []

const get = (profile, command, color) => {
  return new Promise((resolve, reject) => {
    const spawned = child.spawn("bash", ["-c", command])
    const transform = (data, enc, next) => {
      let msg = {SERVICE: profile, COLOR: color, message: data.toString()}
      results.push(msg)
      next()
    }
    let pending = 2
    let onDone = (err) => {
      if (err) return reject(err)
      if (--pending === 0) resolve()
    }
    pump(
      spawned.stdout,
      split(),
      through.obj(transform),
      onDone
    )
    pump(
      spawned.stderr,
      split(),
      through.obj(transform),
      onDone
    )
  })
}

const print = (entry) => {
  if (argv.json) return log(JSON.stringify(entry)) 
  log(chalk[entry.COLOR]('[', entry.SERVICE, ']', JSON.stringify(entry.message, null, '  ')))
}

const run = async () => {
  const cmds = {}
  config.map((c) => {
    const command = `eval \`awsume ${c.profile} -s\` 
qaws --groups '${c.groups.join("' '")}' --time '${time}'${end ? " '" + end + "'": ""} --query '${insightsQuery}'`
    cmds[c.profile] = {
      command: command,
      color: c.color,
      profile: c.profile
    }
  })
  let keys = Object.keys(cmds)
  if (argv.profile) keys = keys.filter((c) => { return c === argv.profile })
  const promises = keys.map((key) => {
    if (argv.v) console.log(cmds[key].command)
    return get(cmds[key].profile, cmds[key].command, cmds[key].color)
  })
  await Promise.all(promises)
  let times = []
  let noTimes = []
  results.map((result) => {
    let timestamp
    let message = result.message
    if (message[10] === ' ' && message[23] === ',' && message[24] === ' ') {
      let parts = message.split(',')
      timestamp = parts.shift()
      message = parts.join(',')
    } else {
      timestamp = message.timestamp
    }

    try {
      message = JSON.parse(message.trim())
    } catch (e) {
      // ignore
    }
    
    let modified = { ...result }
    modified.message = message
    modified.timestamp = timestamp

    if (timestamp) {
      times.push(modified)
    } else {
      noTimes.push(modified)
    }
  })

  if (argv.v) noTimes.forEach(print)
  times.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  times.forEach(print)
}

run()

