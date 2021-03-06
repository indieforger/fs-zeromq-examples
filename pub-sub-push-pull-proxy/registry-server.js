'use strict'
const zmq = require('zmq')

process.stdin.resume()
//require('tty').setRawMode(true)

const pullSock = zmq.socket('pull')
const pushSock = zmq.socket('push')
const pubSock = zmq.socket('pub')
const actions = [] // {id, pattern}

pullSock.bindSync("tcp://*:5000")
pushSock.bindSync("tcp://*:5001")
pubSock.bindSync("tcp://*:5002")

process.on('SIGINT', function() {
  pushSock.close()
  pullSock.close()
  pubSock.close()
  process.exit()
})

pullSock.on('message', function() {

  let pattern = arguments[0].toString()
  let type = pattern.split(' ').shift()
  let data = arguments[1].toString()

  console.log('PULL\t', pattern, '\t', data)

  switch(type) {
    case 'REQ':
      console.log('PUB\t', pattern, '\t', data)
      pubSock.send([pattern, data])
      break
    case 'REP':
      console.log('PUSH\t', pattern, '\t', data)
      pushSock.send([pattern, data])
      break
  }
})
