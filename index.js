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
  const player1Move = moves[players[0].id]
  const player2Move = moves[players[1].id]
  const result = RPSWinTable[player1Move][player2Move]
  switch (result) {
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
  return result
}

let waitingUser = null

function checkForWaiting(socket) {
  const dcHandler = () => {
    waitingUser.removeAllListeners()
    waitingUser = null
  }
  if (waitingUser) {
    waitingUser.removeAllListeners()
    newGame([waitingUser, socket])
    waitingUser.emit('state', 'opponent change')
    socket.emit('state', 'opponent change')
    waitingUser = null
  } else {
    waitingUser = socket
    waitingUser.emit('state', 'waiting')
    waitingUser.on('disconnect', dcHandler)
  }
}

function roundFinished(moves) {
  const keys = Object.keys(moves)
  return keys.filter(key => moves[key] === null).length === 0
}

function newGame(players, score) {
  const moves = {}
  score = score || [0, 0]
  players[0].emit('score', score)
  players[1].emit('score', [score[1], score[0]])
  players.forEach(player => {
    player.emit('state', 'new game')
    moves[player.id] = null
    const listeners = {}
    listeners.move = (move) => {
      if (moves[player.id] === null) {
        moves[player.id] = move
        if (roundFinished(moves)) {
          const firstPlayerWon = finishRound(moves, players)
          if (firstPlayerWon) score[0]++
          else if (firstPlayerWon === false) score[1]++
          players.forEach(p => p.removeAllListeners())
          newGame(players, score)
        }
      } else {
        player.emit('info', 'stop spamming')
      }
    }
    listeners.chat = (msg) => {
      broadcastToOthers(player.id, players, 'chat', msg)
    }
    listeners.disconnect = () => {
      players.filter(p => p.id !== player.id).forEach(nonDCPlayer => {
        nonDCPlayer.emit('state', 'opponent disconnect')
        nonDCPlayer.removeAllListeners()
        checkForWaiting(nonDCPlayer)
      })
    }
    player.on('move', listeners['move'])
    player.on('chat', listeners['chat'])
    player.on('disconnect', listeners['disconnect'])
  })
}
