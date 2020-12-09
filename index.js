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

let insightsQuery = argv.query || 'fields @message, @timestamp'

const time = argv.time || '5m'
if (!argv.q) console.error('Querying logs for time window', time, 'with query:', insightsQuery)

const results = []

const get = (profile, command, color) => {
  return new Promise((resolve, reject) => {
    const spawned = child.spawn("bash", ["-c", command])
    const transform = (data, enc, next) => {
      let msg
      try {
        let obj = JSON.parse(data)
        msg = {
          SERVICE: profile,
          COLOR: color,
          message: obj
        }
      } catch (e) {
        msg = {SERVICE: profile, COLOR: color, message: data.toString()}
      }
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
  let mapped = {
    task: entry.message.task,
    timestamp: entry.message.timestamp,
    error: entry.message.message,
  }
  if (entry.message.details) mapped.order = entry.message.details.order
  if (argv.json) return log(JSON.stringify(entry)) 

  if (typeof entry.message !== 'object') mapped = entry.message
  log(chalk[entry.COLOR]('[', entry.SERVICE, ']', JSON.stringify(mapped, null, '  ')))
}

const run = async () => {
  const cmds = {}
  config.map((c) => {
    cmds[c.profile] = {
      command: `eval \`awsume ${c.profile} -s\` 
qaws --groups '${c.groups.join("' '")}' --time '${time}' --query '${insightsQuery}'`,
      color: c.color,
      profile: c.profile
    }
  })
  const promises = Object.keys(cmds).map((key) => {
    return get(cmds[key].profile, cmds[key].command, cmds[key].color)
  })
  await Promise.all(promises)
  let times = []
  let noTimes = []
  results.map((result) => {
    if (result.message.timestamp) {
      times.push(result)
    }
    else noTimes.push(result)
  })
  noTimes.forEach(print)
  times.sort((a, b) => a.message.timestamp.localeCompare(b.message.timestamp))
  times.forEach(print)
}

run()
