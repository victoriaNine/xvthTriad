import { find, each, clone, filter, isFunction } from 'lodash';
import socket from 'socket.io';
import moment from 'moment-timezone';

const saveConfig = { charOffset: process.env.SAVE_CHAR_OFFSET, charSeparator: process.env.SAVE_CHAR_SEPARATOR };

export default function setupSockets (server, db, cronJobs) {
  const io             = socket.listen(server);
  const CLIENT_LIST    = io.sockets.connected;
  let CLIENT_COUNT     = 0;
  const ROOM_LIST      = io.sockets.adapter.rooms;
  const RESERVED_ROOMS = [];
  const LOUNGE_NAME    = "xvthTriad_LOUNGE";
  let LOUNGE_ROOM      = null;

  RESERVED_ROOMS.push(LOUNGE_NAME);
  each(RESERVED_ROOMS, (roomName) => {
    io.sockets.adapter.createRoom(roomName, { permanent: true });
  });

  LOUNGE_ROOM              = ROOM_LIST[LOUNGE_NAME];
  LOUNGE_ROOM.playingUsers = {};

  io.sockets.on("connection", (socket) => {
    socket.userId            = null;
    socket.opponent          = null;
    socket.typingInRoom      = null;
    socket.currentRoomName   = null;
    socket.hasPendingRequest = false;
    socket.canReceiveRequest = false;
    socket.isReady           = false;
    socket.isInGame          = false;
    socket.isInLounge        = false;
    socket.hasConfirmedEnd   = false;
    socket.playerInfo        = {};
    socket.playerActions     = {};
    socket.selectedCards     = [];
    socket.points            = -1;
    socket.ip                = socket.request.headers["x-forwarded-for"] || socket.request.connection.remoteAddress;

    io.emit("in:updateOnlineCount", {
      status : "ok",
      msg    : ++CLIENT_COUNT
    });

    console.log(moment.tz("Europe/Paris").format("YYYY.MM.DD @ HH:mm:ss"), "-- A user connected (" + getClientName(socket) + "). Players online:", CLIENT_COUNT);
    console.log("=======");

    db.query("auth/verifiedUsers").then((result) => {
      socket.emit("in:socketReady", {
        status : "ok",
        msg    : result.total_rows
      });
    }).catch((error) => {
      console.error("connect.js@320", error);
    });

    socket.on("disconnect", () => {
      io.emit("in:updateOnlineCount", {
        status : "ok",
        msg    : --CLIENT_COUNT
      });

      console.log(moment.tz("Europe/Paris").format("YYYY.MM.DD @ HH:mm:ss"), "-- A user disconnected (" + getClientName(socket) + "). Players online:", CLIENT_COUNT);
      console.log("=======");

      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "disconnected.");
        socket.to(socket.opponent.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "disconnection"
          }
        });

        if (socket.isInLounge) {
          onLoungeGameEnd(socket.userId, socket.opponent.userId);
          sendServiceMessage({
            roomName   : LOUNGE_ROOM.name,
            date       : new Date().toJSON(),
            type       : "gameAbort",
            data       : {
              emitterId   : ROOM_LIST[socket.currentRoomName].emitter.userId,
              receiverId  : ROOM_LIST[socket.currentRoomName].receiver.userId,
              abortUserId : socket.userId,
              reason      : "disconnection"
            }
          });
        }

        playerReset(socket.opponent);
      }

      if (socket.isInLounge) {
        onLoungeLeave(socket);
      }
    });

    socket.on("out:getOnlineCount", () => {
      socket.emit("in:getOnlineCount", {
        status : "ok",
        msg    : CLIENT_COUNT
      });
    });

    socket.on("out:login", (userId) => {
      const currentConnections = getAllClientsOfUserId(userId);

      if (currentConnections.length) {
        each(currentConnections, (client) => {
          console.log("Kicking", client.ip, "-- Double connection detected for userId:", userId);
          onLogout(client);
          client.emit("in:kick", {
            status : "error",
            msg    : {
              reason: "dblConnection"
            }
          });
        });

        console.log("User", socket.ip, "was refused connection with userId:", userId);
        socket.emit("in:kick", {
          status : "error",
          msg    : {
            reason : "dblConnection",
            logout : true
          }
        });
      } else {
        socket.userId = userId;
        console.log(socket.userId + " (" + socket.ip + ") logged in.");
        console.log("=======");

        socket.emit("in:login", {
          status: "ok"
        });
      }
    });

    socket.on("out:logout", () => {
      onLogout(socket);
    });

    socket.on("out:getLoungeCount", () => {
      socket.emit("in:getLoungeCount", {
        status : "ok",
        msg    : LOUNGE_ROOM ? LOUNGE_ROOM.length : 0
      });
    });

    socket.on("out:getLoungeMessageHistory", () => {
      socket.emit("in:getLoungeMessageHistory", {
        status : "ok",
        msg    : getRoomMessageHistory(LOUNGE_ROOM.name)
      });
    });

    socket.on("out:getLoungeUserlist", () => {
      socket.emit("in:getLoungeUserlist", {
        status : "ok",
        msg    : getRoomUserlist(LOUNGE_ROOM.name)
      });
    });

    socket.on("out:getRoomMessageHistory", (roomName) => {
      socket.emit("in:getRoomMessageHistory", {
        status : "ok",
        msg    : getRoomMessageHistory(roomName)
      });
    });

    socket.on("out:getRoomUserlist", (roomName) => {
      socket.emit("in:getRoomUserlist", {
        status : "ok",
        msg    : getRoomUserlist(roomName)
      });
    });

    socket.on("out:joinLounge", (userInfo) => {
      socket.join(LOUNGE_ROOM.name, proceed);

      function proceed () {
        socket.isInLounge        = true;
        socket.playerInfo        = clone(userInfo);
        socket.canReceiveRequest = true;
        delete socket.playerInfo.isTyping;
        delete socket.playerInfo.opponentId;
        console.log(socket.userId, "(" + socket.ip + ") joined the lounge room. Players in the lounge:", LOUNGE_ROOM.length);

        socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
          status : "ok",
          msg  : {
            type        : "userJoined",
            userId      : socket.userId,
            userInfo,
            onlineCount : LOUNGE_ROOM.length
          }
        });

        sendServiceMessage({
          roomName   : LOUNGE_ROOM.name,
          date       : new Date().toJSON(),
          type       : "userJoined",
          data       : {
            userId: socket.userId
          }
        });

        io.emit("in:updateLoungeCount", {
          status : "ok",
          msg    : LOUNGE_ROOM.length
        });

        socket.emit("in:joinLounge", {
          status : "ok",
          msg    : {
            name        : LOUNGE_ROOM.name,
            onlineCount : LOUNGE_ROOM.length
          }
        });
      }
    });

    socket.on("out:rejoinLounge", (userInfo) => {
      socket.playerInfo        = userInfo;
      socket.canReceiveRequest = true;
      delete socket.playerInfo.isTyping;
      delete socket.playerInfo.opponentId;
      console.log(socket.userId, "(" + socket.ip + ") is back in the lounge room from a game.");

      socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
        status : "ok",
        msg  : {
          type     : "userUpdate",
          userId   : socket.userId,
          userInfo,
        }
      });

      socket.emit("in:rejoinLounge", {
        status : "ok",
        msg    : LOUNGE_ROOM.name
      });
    });

    socket.on("out:leaveLounge", () => {
      onLoungeLeave(socket);
    });

    socket.on("out:startedTyping", (roomName) => {
      socket.typingInRoom = roomName;
      ROOM_LIST[roomName].typingUsers.push(socket.userId);
      socket.broadcast.to(roomName).emit("in:updateTypingUsers", {
        status : "ok",
        msg    : ROOM_LIST[roomName].typingUsers
      });

      socket.emit("in:startedTyping", {
        status : "ok"
      });
    });

    socket.on("out:stoppedTyping", (roomName) => {
      const typingUserIndex = ROOM_LIST[roomName].typingUsers.indexOf(socket.userId);
      if (typingUserIndex !== -1) {
        socket.typingInRoom = null;
        ROOM_LIST[roomName].typingUsers.splice(typingUserIndex, 1);
      }

      socket.broadcast.to(roomName).emit("in:updateTypingUsers", {
        status : "ok",
        msg    : ROOM_LIST[roomName].typingUsers
      });
      socket.emit("in:stoppedTyping", {
        status : "ok"
      });
    });

    socket.on("out:sendMessage", (msgData) => {
      socket.broadcast.to(msgData.roomName).emit("in:receiveMessage", {
        status : "ok",
        msg    : msgData
      });
      socket.emit("in:sendMessage", {
        status : "ok"
      });

      addToRoomMessageHistory(msgData.roomName, msgData);
    });

    socket.on("out:sendChallenge", (data) => {
      const opponent = getClientByUserId(data.to);

      if (opponent.hasPendingRequest || opponent.opponent || !opponent.canReceiveRequest) {
        socket.emit("in:sendChallenge", {
          status : "warn",
          msg    : {
            reason : opponent.hasPendingRequest ? "pendingRequest" :
              opponent.opponent ? "alreadyPlaying" : "unavailable"
          }
        });
      } else {
        socket.hasPendingRequest   = true;
        opponent.hasPendingRequest = true;
        socket.to(opponent.id).emit("in:receiveChallenge", {
          status : "ok",
          msg    : { from: socket.userId }
        });

        sendServiceMessage({
          roomName   : LOUNGE_ROOM.name,
          date       : new Date().toJSON(),
          type       : "challengeSent",
          data       : {
            emitterId  : socket.userId,
            receiverId : opponent.userId
          }
        });

        socket.emit("in:sendChallenge", {
          status : "ok"
        });
      }
    });

    socket.on("out:sendChallengeReply", (data) => {
      const opponent = getClientByUserId(data.to);

      // We check the opponent is still online
      if (opponent && opponent.isInLounge) {
        if (data.reply === "accept") {
          socket.canReceiveRequest   = false;
          opponent.canReceiveRequest = false;
        }

        socket.to(opponent.id).emit("in:receiveChallengeReply", {
          status : "ok",
          msg    : {
            reply : data.reply,
            from  : socket.userId
          }
        });

        sendServiceMessage({
          roomName   : LOUNGE_ROOM.name,
          date       : new Date().toJSON(),
          type       : data.reply === "accept" ? "challengeAccepted" : "challengeDeclined",
          data       : {
            emitterId  : opponent.userId, // The emitter is always the one who sent the request
            receiverId : socket.userId    // The receiver is the one replying to the request
          }
        });

        socket.emit("in:sendChallengeReply", {
          status : "ok"
        });
      } else if (opponent && !opponent.isInLounge) {
        socket.emit("in:sendChallengeReply", {
          status : "error",
          msg    : { reason: "otherPlayerLeft" }
        });
      } else {
        socket.emit("in:sendChallengeReply", {
          status : "error",
          msg    : { reason: "otherPlayerDisconnected" }
        });
      }
    });

    socket.on("out:cancelChallenge", (data) => {
      const opponent = getClientByUserId(data.to);

      // We check the opponent is still online
      if (opponent && opponent.isInLounge) {
        socket.to(opponent.id).emit("in:challengeCancelled", {
          status : "ok",
          msg    : {
            from   : socket.userId,
            reason : "otherPlayerCancelled"
          }
        });

        sendServiceMessage({
          roomName   : LOUNGE_ROOM.name,
          date       : new Date().toJSON(),
          type       : "challengeCancelled",
          data       : {
            emitterId  : socket.userId,
            receiverId : opponent.userId
          }
        });

        socket.emit("in:cancelChallenge", {
          status : "ok"
        });
      } else if (opponent && !opponent.isInLounge) {
        socket.emit("in:cancelChallenge", {
          status : "warn",
          msg    : { reason: "otherPlayerLeft" }
        });
      } else {
        socket.emit("in:cancelChallenge", {
          status : "warn",
          msg    : { reason: "otherPlayerDisconnected" }
        });
      }
    });

    socket.on("out:releasePending", (data) => { // eslint-disable-line no-unused-vars
      socket.hasPendingRequest = false;

      socket.emit("in:releasePending", {
        status : "ok"
      });
    });

    socket.on("out:setupChallengeRoom", (data) => {
      const opponent  = getClientByUserId(data.with);
      const roomName  = getUID(16, ROOM_LIST, LOUNGE_ROOM.name + "-");
      let joinCount = 0;

      /* eslint-disable max-nested-callbacks */
      leaveAllRooms(socket, () => {
        leaveAllRooms(opponent, () => {
          socket.join(roomName, () => { if (++joinCount === 2) { proceed(); } });
          opponent.join(roomName, () => { if (++joinCount === 2) { proceed(); } });

          function proceed () {
            socket.currentRoomName     = roomName;
            opponent.currentRoomName   = roomName;
            socket.opponent            = opponent;
            opponent.opponent          = socket;

            ROOM_LIST[roomName].emitter  = socket;
            ROOM_LIST[roomName].receiver = opponent;
            ROOM_LIST[roomName].hasEnded = false;
            ROOM_LIST[roomName].rounds   = 0;

            console.log("Room", roomName, "-- emitter --", socket.userId, "do setupChallengeRoom");
            console.log("Room", roomName, "-- receiver --", opponent.userId, "do setupChallengeRoom");

            LOUNGE_ROOM.playingUsers[socket.userId]   = opponent.userId;
            LOUNGE_ROOM.playingUsers[opponent.userId] = socket.userId;
            io.to(LOUNGE_ROOM.name).emit("in:updatePlayingUsers", {
              status : "ok",
              msg    : LOUNGE_ROOM.playingUsers
            });

            sendServiceMessage({
              roomName   : LOUNGE_ROOM.name,
              date       : new Date().toJSON(),
              type       : "gameStart",
              data       : {
                emitterId  : socket.userId,
                receiverId : opponent.userId
              }
            });

            socket.emit("in:setupChallengeRoom", {
              status : "ok",
              msg    : {
                roomName,
                mode     : "create"
              }
            });

            opponent.emit("in:setupChallengeRoom", {
              status : "ok",
              msg    : {
                roomName,
                mode     : "join"
              }
            });
          }
        });
      });
    });
    /* eslint-enable */

    socket.on("out:createRoom", (data) => {
      const roomName = data.settings.roomName;

      if (ROOM_LIST[roomName] || RESERVED_ROOMS.indexOf(roomName) !== -1) {
        socket.emit("in:createRoom", {
          status : "error",
          msg    : {
            reason  : (RESERVED_ROOMS.indexOf(roomName) !== -1) ? "reserved" : "alreadyExists",
            roomName,
          }
        });
      } else {
        leaveAllRooms(socket, () => {
          socket.playerInfo      = data.playerInfo;
          socket.currentRoomName = roomName;

          console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "do createRoom");

          /* eslint-disable max-nested-callbacks */
          socket.join(socket.currentRoomName, () => {
            const newRoom      = ROOM_LIST[socket.currentRoomName];
            newRoom.emitter  = socket;
            newRoom.hasEnded = false;
            newRoom.rounds   = 0;

            socket.emit("in:createRoom", {
              status : "ok"
            });
          });
          /* eslint-enable */
        });
      }
    });

    socket.on("out:joinRoom", (data) => {
      const roomName = data.settings.roomName;
      const newRoom  = ROOM_LIST[roomName];

      if (newRoom && RESERVED_ROOMS.indexOf(roomName) === -1) {
        if (newRoom.length < 2) {
          if (!isFromSameBrowser(socket, newRoom.emitter)) {
            leaveAllRooms(socket, () => {
              if (newRoom.length < 2) {
                socket.playerInfo      = data.playerInfo;
                socket.currentRoomName = roomName;
                console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "do joinRoom");

                /* eslint-disable max-nested-callbacks */
                socket.join(socket.currentRoomName, () => {
                  newRoom.receiver         = socket;
                  socket.opponent          = newRoom.emitter;
                  newRoom.emitter.opponent = socket;

                  socket.to(socket.opponent.id).emit("in:opponentJoined", {
                    status : "ok",
                    msg    : {
                      opponent: socket.playerInfo
                    }
                  });

                  socket.emit("in:joinRoom", {
                    status : "ok",
                    msg    : {
                      opponent: socket.opponent.playerInfo
                    }
                  });
                });
                /* eslint-enable */
              } else {
                socket.emit("in:joinRoom", {
                  status : "error",
                  msg    : {
                    reason: "alreadyFull",
                    roomName,
                  }
                });
              }
            });
          } else {
            socket.emit("in:joinRoom", {
              status : "error",
              msg    : {
                reason: "sameBrowser",
                roomName,
                emitterName: newRoom.emitter.playerInfo.name
              }
            });
          }
        } else {
          socket.emit("in:joinRoom", {
            status : "error",
            msg    : {
              reason  : "alreadyFull",
              roomName,
            }
          });
        }
      } else {
        socket.emit("in:joinRoom", {
          status : "error",
          msg    : {
            reason  : (RESERVED_ROOMS.indexOf(roomName) !== -1) ? "reserved" : "doesntExists",
            roomName,
          }
        });
      }
    });

    socket.on("out:leaveRoom", (data) => { // eslint-disable-line no-unused-vars
      socket.leave(socket.currentRoomName, () => {
        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do leaveRoom");
        socket.currentRoomName = null;
        socket.emit("in:leaveRoom", {
          status : "ok"
        });
      });
    });

    socket.on("out:setRules", (data) => {
      if (ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        ROOM_LIST[socket.currentRoomName].rules = data;

        console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "set rules");
        if (socket.opponent) {
          console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "send rules");
          socket.to(socket.opponent.id).emit("in:getRules", {
            status : "ok",
            msg    : data
          });
        }

        socket.emit("in:setRules", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:getRules", (data) => { // eslint-disable-line no-unused-vars
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "get rules");
        socket.emit("in:getRules", {
          status : "ok",
          msg    : ROOM_LIST[socket.currentRoomName].rules
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:setElementBoard", (data) => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        ROOM_LIST[socket.currentRoomName].elementBoard = data;

        console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "set and send elementBoard:", data);
        socket.to(socket.opponent.id).emit("in:getElementBoard", {
          status : "ok",
          msg    : data
        });

        socket.emit("in:setElementBoard", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:getElementBoard", (data) => { // eslint-disable-line no-unused-vars
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "get elementBoard:", ROOM_LIST[socket.currentRoomName].elementBoard);
        socket.emit("in:getElementBoard", {
          status : "ok",
          msg    : ROOM_LIST[socket.currentRoomName].elementBoard
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:setFirstPlayer", (data) => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        ROOM_LIST[socket.currentRoomName].firstPlayer = data;

        console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "set and send firstPlayer:", data);
        socket.to(socket.opponent.id).emit("in:getFirstPlayer", {
          status : "ok",
          msg    : data
        });

        socket.emit("in:setFirstPlayer", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:getFirstPlayer", (data) => { // eslint-disable-line no-unused-vars
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "get firstPlayer:", ROOM_LIST[socket.currentRoomName].firstPlayer);
        socket.emit("in:getFirstPlayer", {
          status : "ok",
          msg    : ROOM_LIST[socket.currentRoomName].firstPlayer
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:setPlayerAction", (data) => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        ROOM_LIST[socket.currentRoomName].currentTurn = data.turnNumber;
        socket.playerActions[data.turnNumber]     = data;

        console.log("Room", socket.currentRoomName, "-- turn", data.turnNumber,"-- playing:", getClientName(socket), "set and send playerAction");
        socket.to(socket.opponent.id).emit("in:getPlayerAction", {
          status : "ok",
          msg    : data
        });

        socket.emit("in:setPlayerAction", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:getPlayerAction", (data) => { // eslint-disable-line no-unused-vars
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        const currentTurn = ROOM_LIST[socket.currentRoomName].currentTurn;

        console.log("Room", socket.currentRoomName, "-- turn", currentTurn,"-- waiting:", getClientName(socket), "get playerAction");
        socket.emit("in:getPlayerAction", {
          status : "ok",
          msg    : socket.opponent.playerActions[currentTurn]
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:setSelectedCards", (data) => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        socket.selectedCards = data;

        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "set and send selected cards");
        socket.to(socket.opponent.id).emit("in:getSelectedCards", {
          status : "ok",
          msg    : data
        });

        socket.emit("in:setSelectedCards", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:getSelectedCards", (data) => { // eslint-disable-line no-unused-vars
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "get selected cards");
        socket.emit("in:getSelectedCards", {
          status : "ok",
          msg    : socket.opponent.selectedCards
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:playerReset", () => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "left the room.");
        socket.to(socket.opponent.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "withdrawal"
          }
        });

        if (socket.isInLounge) {
          onLoungeGameEnd(socket.userId, socket.opponent.userId);
          sendServiceMessage({
            roomName   : LOUNGE_ROOM.name,
            date       : new Date().toJSON(),
            type       : "gameAbort",
            data       : {
              emitterId   : ROOM_LIST[socket.currentRoomName].emitter.userId,
              receiverId  : ROOM_LIST[socket.currentRoomName].receiver.userId,
              abortUserId : socket.userId,
              reason      : "withdrawal"
            }
          });
        }

        playerReset(socket.opponent);
      }

      playerReset(socket);

      socket.emit("in:playerReset", {
        status : "ok"
      });
    });

    socket.on("out:roundReset", () => {
      if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
        console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "do roundReset");
        ROOM_LIST[socket.currentRoomName].currentTurn  = -1;
        ROOM_LIST[socket.currentRoomName].firstPlayer  = null;
        ROOM_LIST[socket.currentRoomName].rounds++;

        socket.playerActions          = {};
        socket.opponent.playerActions = {};

        socket.emit("in:roundReset", {
          status : "ok"
        });
      } else {
        io.to(socket.id).emit("in:otherPlayerLeft", {
          status : "error",
          msg    : {
            reason: "lag"
          }
        });
      }
    });

    socket.on("out:confirmReady", (userDeck) => {
      socket.playerInfo.deck = userDeck;
      socket.isReady = true;
      console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do confirmReady");

      if (socket.opponent && socket.opponent.isReady && ROOM_LIST[socket.currentRoomName].length === 2) {
        socket.isInGame          = true;
        socket.opponent.isInGame = true;

        console.log("Room", socket.currentRoomName, "-- players ready");
        socket.emit("in:confirmReady", {
          status : "ok",
          msg    : {
            opponent: socket.opponent.playerInfo
          }
        });
        socket.to(socket.opponent.id).emit("in:confirmReady", {
          status : "ok",
          msg    : {
            opponent: socket.playerInfo
          }
        });
      }
    });

    socket.on("out:cancelReady", (data) => { // eslint-disable-line no-unused-vars
      console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do cancelReady");
      socket.isReady = false;

      socket.emit("in:cancelReady", {
        status : "ok"
      });
    });

    socket.on("out:confirmEnd", (points) => {
      socket.hasConfirmedEnd = true;
      socket.points          = points;

      if (socket.opponent.hasConfirmedEnd) {
        const emitter  = ROOM_LIST[socket.currentRoomName].emitter;
        const receiver = ROOM_LIST[socket.currentRoomName].receiver;
        const rounds   = ROOM_LIST[socket.currentRoomName].rounds;
        ROOM_LIST[socket.currentRoomName].hasEnded = true;

        if (socket.isInLounge) {
          onLoungeGameEnd(socket.userId, socket.opponent.userId);
          sendServiceMessage({
            roomName   : LOUNGE_ROOM.name,
            date       : new Date().toJSON(),
            type       : "gameEnd",
            data       : {
              emitterId      : emitter.userId,
              receiverId     : receiver.userId,
              emitterPoints  : emitter.points,
              receiverPoints : receiver.points,
              rounds,
            }
          });
        }

        socket.emit("in:confirmEnd", {
          status : "ok"
        });

        socket.to(socket.opponent.id).emit("in:confirmEnd", {
          status : "ok"
        });
      }
    });

    socket.on("out:getUser", (data) => {
      db.get(data.msg).then((userDoc) => {
        socket.emit("in:getUser", {
          status     : "ok",
          callbackId : data.callbackId,
          msg        : userDoc
        });
      }).catch((error) => {
        console.error("connect.js@1062", error);
      });
    });

    socket.on("out:encodeSaveData", (data) => {
      const JSONdata    = JSON.stringify(data.JSONdata);
      const prefix      = data.prefix;
      let encodedData   = prefix;

      each(JSONdata.split(""), (char) => {
        encodedData += saveConfig.charSeparator + (char.codePointAt(0) + parseFloat(saveConfig.charOffset));
      });

      socket.emit("in:encodeSaveData", {
        status : "ok",
        msg    : encodedData
      });
    });

    socket.on("out:decodeSaveData", (data) => {
      const encodedData = data.encodedData;
      const prefix      = data.prefix;
      let JSONdata      = "";

      each(encodedData.replace(prefix, "").match(new RegExp(saveConfig.charSeparator + "\\d+", "g")), (chunk) => {
        JSONdata += String.fromCodePoint(chunk.match(/\d+/) - parseFloat(saveConfig.charOffset));
      });

      socket.emit("in:decodeSaveData", {
        status : "ok",
        msg    : JSON.parse(JSONdata)
      });
    });

    socket.on("out:getRanking", (data) => {
      const name  = data.msg.name;
      let ranking = null;

      if (name === "aceOfCards") {
        ranking = cronJobs.rankings.result.aceOfCards;
      } else if (name === "theCollector") {
        ranking = cronJobs.rankings.result.theCollector;
      }

      socket.emit("in:getRanking", {
        status     : "ok",
        callbackId : data.callbackId,
        msg        : ranking
      });
    });

    function playerReset (client) {
      client.isReady         = false;
      client.isInGame        = false;
      client.hasConfirmedEnd = false;
      client.opponent        = null;
      client.playerActions   = {};
      client.selectedCards   = [];
      client.points          = -1;

      delete client.playerInfo.deck;
      client.leave(client.currentRoomName, () => {
        console.log("Room", client.currentRoomName, "--", getClientName(client), "do playerReset");
        client.currentRoomName = null;
        client.emit("in:playerReset", {
          status : "ok"
        });
      });
    }

    function onLogout (client) {
      if (client.isInLounge) {
        onLoungeLeave(client, proceed);
      } else {
        proceed();
      }

      function proceed () {
        console.log(client.userId + " (" + client.ip + ") logged out.");
        console.log("=======");

        client.userId = null;
        client.emit("in:logout", {
          status : "ok"
        });
      }
    }

    function onLoungeLeave (client, callback) {
      client.leave(LOUNGE_ROOM.name, proceed);

      function proceed () {
        client.isInLounge        = false;
        client.hasPendingRequest = false;
        client.canReceiveRequest = false;
        console.log(client.userId, "(" + client.ip + ") left the lounge room. Players in the lounge:", LOUNGE_ROOM.length);

        sendServiceMessage({
          roomName   : LOUNGE_ROOM.name,
          date       : new Date().toJSON(),
          type       : "userLeft",
          data       : {
            userId: client.userId
          }
        });

        client.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
          status : "ok",
          msg    : {
            type        : "userLeft",
            userId      : client.userId,
            onlineCount : LOUNGE_ROOM.length
          }
        });

        io.emit("in:updateLoungeCount", {
          status : "ok",
          msg    : LOUNGE_ROOM.length
        });

        client.emit("in:leaveLounge", {
          status : "ok"
        });

        if (callback) {
          callback();
        }
      }
    }

    function onLoungeGameEnd (player1Id, player2Id) {
      delete LOUNGE_ROOM.playingUsers[player1Id];
      delete LOUNGE_ROOM.playingUsers[player2Id];

      io.to(LOUNGE_ROOM.name).emit("in:updatePlayingUsers", {
        status : "ok",
        msg    : LOUNGE_ROOM.playingUsers
      });
    }

    function sendServiceMessage (serviceMsgData) {
      serviceMsgData.serviceMsg = true;

      io.to(serviceMsgData.roomName).emit("in:serviceMessage", {
        status : "ok",
        msg    : serviceMsgData
      });

      addToRoomMessageHistory(serviceMsgData.roomName, serviceMsgData);
    }

    function isFromSameBrowser (clientA, clientB) {
      if (clientA.handshake.address === clientB.handshake.address
        && clientA.handshake.headers["user-agent"] === clientB.handshake.headers["user-agent"]
      ) {
        return true;
      }

      return false;
    }

    function getClientName (client) {
      return client.userId || client.ip;
    }

    function getClientByUserId (userId) {
      return find(CLIENT_LIST, { userId }) || null;
    }

    function getAllClientsOfUserId (userId) {
      return filter(CLIENT_LIST, { userId });
    }

    function getRoomMessageHistory (roomName) {
      if (!ROOM_LIST[roomName]) {
        return [];
      }

      return ROOM_LIST[roomName].messages;
    }

    function getRoomUserlist (roomName) {
      if (!ROOM_LIST[roomName] || !ROOM_LIST[roomName].length) {
        return {};
      }

      let client;
      const userlist = {};
      each(ROOM_LIST[roomName].sockets, (clientStatus, clientId) => {
        client                  = CLIENT_LIST[clientId];
        userlist[client.userId] = {
          ...client.playerInfo,
          isTyping   : client.typingInRoom === roomName,
          opponentId : client.opponent ? client.opponent.userId : null
        };
      });

      return userlist;
    }

    function getUID (length, usedList, base) {
      length   = length || 32;
      usedList = usedList || {};
      base     = base || "";

      const chars      = "0123456789abcdefghijklmnopqrstuvwxyz_";
      let string     = "";
      const charsCount = chars.length;

      for (let i = 0; i < length; i++) {
        string += chars[parseInt(Math.random() * charsCount, 10)];
      }

      string = base + string;
      return usedList[string] ? getUID(length, usedList) : string;
    }

    function leaveAllRooms (client, callback) {
      let roomsLeft    = 0;
      const roomsToLeave = filter(client.rooms, (room, roomName) => {
        return (roomName !== client.id && roomName !== LOUNGE_ROOM.name);
      });

      if (!roomsToLeave.length && isFunction(callback)) {
        callback();
      } else {
        // Leave all rooms but the client's private room and the lounge
        each(roomsToLeave, (room, roomName) => {
          client.leave(roomName, () => {
            roomsLeft++;

            if (roomsLeft === roomsToLeave.length && isFunction(callback)) {
              callback();
            }
          });
        });
      }
    }

    function addToRoomMessageHistory (roomName, msgData) {
      if (!ROOM_LIST[roomName]) {
        console.log("addToRoomMessageHistory: room", roomName, "doesn't exist. Cannot add message to message history.");
        return;
      }

      ROOM_LIST[roomName].messages.push(msgData);
      if (ROOM_LIST[roomName].messages.length > 150) {
        ROOM_LIST[roomName].messages.splice(0, 1);
      }
    }
  });
}
