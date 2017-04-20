const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const port = process.env.PORT || 3001

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', checkForWaiting)

http.listen(port, () => {
  console.log('listening on *:' + port)
})

function broadcastToOthers(senderId, targets, eventType, msg) {
  targets.forEach(target => {
    if (target.id !== senderId) {
      target.emit(eventType, msg)
    }
  })
}

// Rock = 0
// Paper = 1
// Scissors = 2
const RPSWinTable = [
  [null, false, true],
  [true, null, false],
  [false, true, null]
]

function finishRound(moves, players) {
  switch (RPSWinTable[moves[players[0].id]]) {
  case true:
    players[0].emit('game', 'You win!')
    players[1].emit('game', 'You lose!')
    break
  case false:
    players[1].emit('game', 'You win!')
    players[0].emit('game', 'You lose!')
    break
  case null:
    players[1].emit('game', 'Even!')
    players[0].emit('game', 'Even!')
    break
  default:
    players[0].emit('game', 'Game blew up!')
    players[1].emit('game', 'Game blew up!')
  }
}

let waitingUser = null

function checkForWaiting(socket) {
  if (waitingUser) {
    newGame([waitingUser, socket])
    waitingUser = null
  } else {
    waitingUser = socket
  }
}

function roundFinished(moves) {
  const keys = Object.keys(moves)
  return keys.filter(key => !moves[key]).length === 0
}

function newGame(players) {
  const moves = {}
  players.forEach(player => {
    moves[player.id] = null
    const listeners = {}
    listeners.move = (move) => {
      if (!moves[player]) {
        moves[player] = move
        if (roundFinished(moves)) {
          finishRound(moves, players)
          player.removeListener('move', listeners['move'])
          player.removeListener('chat', listeners['chat'])
          newGame(players)
        }
      } else {
        //fuk the client for spamming
      }
    }
    listeners.chat = (msg) => {
      broadcastToOthers(player.id, players, 'chat', msg)
    }
    player.on('move', listeners['move'])
    player.on('chat', listeners['chat'])
    player.on('disconnect', () => {
      players.filter(p => p.id !== player.id).forEach(nonDCPlayer => {
        nonDCPlayer.removeListener('move', listeners['move'])
        nonDCPlayer.removeListener('chat', listeners['chat'])
        checkForWaiting(nonDCPlayer)
      })
    })
  })
}
