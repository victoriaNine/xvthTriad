module.exports = function (grunt, options) {
    var _                = require("lodash");
    var lrSnippet        = require("connect-livereload")({ port: grunt.config("livereloadPort") });
    var path             = require("path");
    var express          = require("express");
    var http             = require("http");
    var fs               = require("fs");
    var compression      = require("compression");
    var bodyParser       = require("body-parser");
    var logger           = require("morgan");
    var SuperLogin       = require("superlogin");
    var FacebookStrategy = require("passport-facebook").Strategy;
    
    grunt.registerTask("connect", function (target) {
        var port     = grunt.config("serverPort");
        var app      = express();
        var folder   = (target === "beta" || target === "dist") ? grunt.config("yeoman")[target] : grunt.config("yeoman").tmp;
        var protocol = process.env.NODE_ENV === "prod" ? "https://" : "http://";
        var server;
        var ip;

        app.set("port", port);
        //app.use(logger("dev"));

        // Setup SuperLogin
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
 
        // Redirect to https except on localhost
        app.use(httpsRedirect);

        var config = {
            dbServer: {
                protocol: process.env.NODE_ENV === "prod" ? "https://" : "http://",
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASS,
                userDB: "users",
                couchAuthDB: "_users"
            },
            emails: {
                confirmMail: {
                    template : "",
                    subject : "",
                    format: "html"
                }
            },
            mailer: {
                fromEmail: process.env.MAILER_NAME + " <" + process.env.MAILER_EMAIL + ">",
                options: "smtps://" + encodeURIComponent(process.env.MAILER_EMAIL) + ":" + process.env.MAILER_PASSWORD + "@" + process.env.MAILER_SMTP
            },
            security: {
                maxFailedLogins: 3,
                lockoutTime: 600,
                tokenLife: 86400,
                loginOnRegistration: false
            },
            local: {
                sendConfirmEmail: true,
                requireEmailConfirm: true,
                confirmEmailRedirectURL: "/confirm-email"
            },
            providers: { 
                local: true
            }
        };
        
        // Initialize SuperLogin 
        var superlogin = new SuperLogin(config);
        if (superlogin.config.getItem("providers.facebook.credentials.clientID")) {
            superlogin.registerOAuth2("facebook", FacebookStrategy);
        }
        
        // Mount SuperLogin's routes to our app 
        app.use("/auth", superlogin.router);

        app.use(compression());
        if (target === "livereload") { app.use(lrSnippet); }
        app.use(express.static(path.resolve(folder)));

        // Not found: just serve index.html
        app.use(function (req, res) {
            var file = folder + "/index.html"; 
            if (grunt.file.exists(file)) {
                fs.createReadStream(file).pipe(res);
                return;
            }

            res.statusCode = 404;
            res.end();
        });

        // Create node.js http server and listen on port
        server = http.createServer(app);
        server.listen(app.get("port"), function () {
            grunt.log.ok("Server listening on port", app.get("port"));
            setupSockets(server);
        });

        // Force HTTPS redirect unless we are using localhost
        function httpsRedirect(req, res, next) {
            if (req.protocol === "https" || req.header("X-Forwarded-Proto") === "https" || req.hostname === "localhost") {
                return next();
            }

            res.status(301).redirect("https://" + req.headers["host"] + req.url);
        }

        function setupSockets (server) {
            var io             = require("socket.io").listen(server);
            var CLIENT_LIST    = io.sockets.connected;
            var CLIENT_COUNT   = 0;
            var ROOM_LIST      = io.sockets.adapter.rooms;
            var RESERVED_ROOMS = [];
            var LOUNGE_NAME    = "xvthTriad_LOUNGE";
            var LOUNGE_ROOM    = null;

            RESERVED_ROOMS.push(LOUNGE_NAME);
            _.each(RESERVED_ROOMS, function (roomName) {
                io.sockets.adapter.createRoom(roomName, { permanent: true });
            });

            LOUNGE_ROOM              = ROOM_LIST[LOUNGE_NAME];
            LOUNGE_ROOM.playingUsers = {};

            io.sockets.on("connection", function (socket) {
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

                console.log("A user connected (" + getClientName(socket) + "). Players online:", CLIENT_COUNT);
                console.log("=======");

                socket.on("disconnect", function () {
                    io.emit("in:updateOnlineCount", {
                        status : "ok",
                        msg    : --CLIENT_COUNT
                    });

                    console.log("A user disconnected (" + getClientName(socket) + "). Players online:", CLIENT_COUNT);
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
                        onLoungeLeave();
                    }
                });

                socket.on("out:getOnlineCount", function () {
                    socket.emit("in:getOnlineCount", {
                        status : "ok",
                        msg    : CLIENT_COUNT
                    });
                });

                socket.on("out:login", function (userId) {
                    var currentConnections = getAllClientsOfUserId(userId);

                    if (currentConnections.length) {
                        _.each(currentConnections, function (client) {
                            console.log("Kicking", client.ip, "-- Double connection detected for userId:", userId);
                            onLogout(client);
                            client.emit("in:kick", {
                                status : "error",
                                msg    : {
                                    reason: "dblConnection"
                                }
                            });
                        });

                        console.log("User", socket.ip, " was refused connection with userId:", userId);
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

                socket.on("out:logout", function () {
                    onLogout(socket);
                });

                socket.on("out:getLoungeCount", function () {
                    socket.emit("in:getLoungeCount", {
                        status : "ok",
                        msg    : LOUNGE_ROOM ? LOUNGE_ROOM.length : 0
                    });
                });

                socket.on("out:getLoungeMessageHistory", function () {
                    socket.emit("in:getLoungeMessageHistory", {
                        status : "ok",
                        msg    : getRoomMessageHistory(LOUNGE_ROOM.name)
                    });
                });

                socket.on("out:getLoungeUserlist", function () {
                    socket.emit("in:getLoungeUserlist", {
                        status : "ok",
                        msg    : getRoomUserlist(LOUNGE_ROOM.name)
                    });
                });

                socket.on("out:getRoomMessageHistory", function (roomName) {
                    socket.emit("in:getRoomMessageHistory", {
                        status : "ok",
                        msg    : getRoomMessageHistory(roomName)
                    });
                });

                socket.on("out:getRoomUserlist", function (roomName) {
                    socket.emit("in:getRoomUserlist", {
                        status : "ok",
                        msg    : getRoomUserlist(roomName)
                    });
                });

                socket.on("out:joinLounge", function (userInfo) {
                    socket.join(LOUNGE_ROOM.name);
                    socket.isInLounge        = true;
                    socket.playerInfo        = _.clone(userInfo);
                    socket.canReceiveRequest = true;
                    delete socket.playerInfo.isTyping;
                    delete socket.playerInfo.opponentId;
                    console.log(socket.userId, "(" + socket.ip + ") joined the lounge room. Players in the lounge:", LOUNGE_ROOM.length);

                    socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
                        status : "ok",
                        msg  : {
                            type     : "userJoined",
                            userInfo : userInfo
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
                        msg  : LOUNGE_ROOM.name
                    });
                });

                socket.on("out:rejoinLounge", function (userInfo) {
                    socket.playerInfo        = userInfo;
                    socket.canReceiveRequest = true;
                    delete socket.playerInfo.isTyping;
                    delete socket.playerInfo.opponentId;
                    console.log(socket.userId, "(" + socket.ip + ") is back in the lounge room from a game.");

                    socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
                        status : "ok",
                        msg  : {
                            type     : "userUpdate",
                            userInfo : userInfo
                        }
                    });

                    socket.emit("in:rejoinLounge", {
                        status : "ok",
                        msg    : LOUNGE_ROOM.name
                    });
                });

                socket.on("out:leaveLounge", onLoungeLeave);

                socket.on("out:startedTyping", function (roomName) {
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

                socket.on("out:stoppedTyping", function (roomName) {
                    var typingUserIndex = ROOM_LIST[roomName].typingUsers.indexOf(socket.userId);
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

                socket.on("out:sendMessage", function (msgData) {
                    socket.broadcast.to(msgData.roomName).emit("in:receiveMessage", {
                        status : "ok",
                        msg    : msgData
                    });
                    socket.emit("in:sendMessage", {
                        status : "ok"
                    });

                    addToRoomMessageHistory(msgData.roomName, msgData);
                });

                socket.on("out:sendChallenge", function (data) {
                    var opponent = getClientByUserId(data.to);

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

                socket.on("out:sendChallengeReply", function (data) {
                    var opponent = getClientByUserId(data.to);
                    socket.hasPendingRequest = false;

                    // We check the opponent is still online
                    if (opponent && opponent.isInLounge) {
                        opponent.hasPendingRequest = false;

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

                socket.on("out:cancelChallenge", function (data) {
                    var opponent = getClientByUserId(data.to);
                    socket.hasPendingRequest = false;

                    // We check the opponent is still online
                    if (opponent && opponent.isInLounge) {
                        opponent.hasPendingRequest = false;

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

                socket.on("out:setupChallengeRoom", function (data) {
                    var opponent = getClientByUserId(data.with);
                    var roomName = getUID(16, ROOM_LIST, LOUNGE_ROOM.name + "-");

                    leaveAllRooms(socket, function () {
                        leaveAllRooms(opponent, function () {
                            socket.join(roomName);
                            opponent.join(roomName);
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
                                    roomName : roomName,
                                    mode     : "create"
                                }
                            });

                            opponent.emit("in:setupChallengeRoom", {
                                status : "ok",
                                msg    : {
                                    roomName : roomName,
                                    mode     : "join"
                                }
                            });
                        });
                    });
                });

                socket.on("out:createRoom", function (data) {
                    var roomName = data.settings.roomName;
                    
                    if (ROOM_LIST[roomName] || RESERVED_ROOMS.indexOf(roomName) !== -1) {
                        socket.emit("in:createRoom", {
                            status : "error",
                            msg    : {
                                reason  : (RESERVED_ROOMS.indexOf(roomName) !== -1) ? "reserved" : "alreadyExists",
                                roomName: roomName
                            }
                        });
                    } else {
                        leaveAllRooms(socket, function () {
                            socket.playerInfo      = data.playerInfo;
                            socket.currentRoomName = roomName;

                            console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "do createRoom");

                            socket.join(socket.currentRoomName, function () {
                                var newRoom      = ROOM_LIST[socket.currentRoomName];
                                newRoom.emitter  = socket;
                                newRoom.hasEnded = false;
                                newRoom.rounds   = 0;

                                socket.emit("in:createRoom", {
                                    status : "ok"
                                });
                            });
                        });
                    }
                });

                socket.on("out:joinRoom", function (data) {
                    var roomName = data.settings.roomName;
                    var newRoom  = ROOM_LIST[roomName];

                    if (newRoom && RESERVED_ROOMS.indexOf(roomName) === -1) {
                        if (newRoom.length < 2) {
                            leaveAllRooms(socket, function () {
                                if (newRoom.length < 2) {
                                    socket.playerInfo      = data.playerInfo;
                                    socket.currentRoomName = roomName;
                                    console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "do joinRoom");

                                    socket.join(socket.currentRoomName, function () {
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
                                } else {
                                    socket.emit("in:joinRoom", {
                                        status : "error",
                                        msg    : {
                                            reason  : "alreadyFull",
                                            roomName: roomName
                                        }
                                    });
                                }
                            });
                        } else {
                            socket.emit("in:joinRoom", {
                                status : "error",
                                msg    : {
                                    reason  : "alreadyFull",
                                    roomName: roomName
                                }
                            });
                        }
                    } else {
                        socket.emit("in:joinRoom", {
                            reason  : (RESERVED_ROOMS.indexOf(roomName) !== -1) ? "reserved" : "alreadyExists",
                            roomName: roomName
                        });
                    }
                });

                socket.on("out:leaveRoom", function (data) {
                    socket.leave(socket.currentRoomName, function () {
                        console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do leaveRoom");
                        socket.currentRoomName = null;
                        socket.emit("in:leaveRoom", {
                            status : "ok"
                        });
                    });
                });

                socket.on("out:setRules", function (data) {
                    ROOM_LIST[socket.currentRoomName].rules = data;

                    console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "set rules:", data);
                    if (socket.opponent) {
                        console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "send rules:", data);
                        socket.to(socket.opponent.id).emit("in:getRules", {
                            status : "ok",
                            msg    : data
                        });
                    }

                    socket.emit("in:setRules", {
                         status : "ok"
                    });
                });

                socket.on("out:getRules", function (data) {
                    console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "get rules:", ROOM_LIST[socket.currentRoomName].rules);
                    socket.emit("in:getRules", {
                        status : "ok",
                        msg    : ROOM_LIST[socket.currentRoomName].rules
                    });
                });

                socket.on("out:setFirstPlayer", function (data) {
                    ROOM_LIST[socket.currentRoomName].firstPlayer = data;

                    console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "set and send firstPlayer:", data);
                    socket.to(socket.opponent.id).emit("in:getFirstPlayer", {
                        status : "ok",
                        msg    : data
                    });

                    socket.emit("in:setFirstPlayer", {
                        status : "ok"
                    });
                });

                socket.on("out:getFirstPlayer", function (data) {
                    console.log("Room", socket.currentRoomName, "-- receiver --", getClientName(socket), "get firstPlayer:", ROOM_LIST[socket.currentRoomName].firstPlayer);
                    socket.emit("in:getFirstPlayer", {
                        status : "ok",
                        msg    : ROOM_LIST[socket.currentRoomName].firstPlayer
                    });
                });

                socket.on("out:setPlayerAction", function (data) {
                    ROOM_LIST[socket.currentRoomName].currentTurn = data.turnNumber;
                    socket.playerActions[data.turnNumber]     = data;

                    console.log("Room", socket.currentRoomName, "-- turn", data.turnNumber,"-- playing:", getClientName(socket), "set and send playerAction:", data);
                    socket.to(socket.opponent.id).emit("in:getPlayerAction", {
                        status : "ok",
                        msg    : data
                    });

                    socket.emit("in:setPlayerAction", {
                        status : "ok"
                    });
                });

                socket.on("out:getPlayerAction", function (data) {
                    var currentTurn = ROOM_LIST[socket.currentRoomName].currentTurn;

                    console.log("Room", socket.currentRoomName, "-- turn", currentTurn,"-- waiting:", getClientName(socket), "get playerAction:", socket.opponent.playerActions[currentTurn]);
                    socket.emit("in:getPlayerAction", {
                         status : "ok",
                         msg    : socket.opponent.playerActions[currentTurn]
                    });
                });

                socket.on("out:setSelectedCards", function (data) {
                    socket.selectedCards = data;

                    console.log("Room", socket.currentRoomName, "--", getClientName(socket), "set and send selected cards:", data);
                    socket.to(socket.opponent.id).emit("in:getSelectedCards", {
                        status : "ok",
                        msg    : data
                    });

                    socket.emit("in:setSelectedCards", {
                        status : "ok"
                    });
                });

                socket.on("out:getSelectedCards", function (data) {
                    console.log("Room", socket.currentRoomName, "--", getClientName(socket), "get selected cards:", socket.opponent.selectedCards);
                    socket.emit("in:getSelectedCards", {
                        status : "ok",
                        msg    : socket.opponent.selectedCards
                    });
                });

                socket.on("out:playerReset", function () {
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
                });

                socket.on("out:roundReset", function () {
                    console.log("Room", socket.currentRoomName, "-- emitter --", getClientName(socket), "do roundReset");
                    ROOM_LIST[socket.currentRoomName].currentTurn = -1;
                    ROOM_LIST[socket.currentRoomName].firstPlayer = null;
                    ROOM_LIST[socket.currentRoomName].rounds++;

                    socket.playerActions          = {};
                    socket.opponent.playerActions = {};

                    socket.emit("in:roundReset", {
                        status : "ok"
                    });
                });

                socket.on("out:confirmReady", function (userDeck) {
                    socket.playerInfo.deck = userDeck;
                    socket.isReady = true;
                    console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do confirmReady", socket.playerInfo);

                    if (socket.opponent && socket.opponent.isReady && ROOM_LIST[socket.currentRoomName].length === 2) {
                        socket.isInGame          = true;
                        socket.opponent.isInGame = true;

                        console.log("Room", socket.currentRoomName, "-- players ready", socket.playerInfo, socket.opponent.playerInfo);
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

                socket.on("out:cancelReady", function (data) {
                    console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do cancelReady");
                    socket.isReady = false;
                });

                socket.on("out:confirmEnd", function (points) {
                    socket.hasConfirmedEnd = true;
                    socket.points          = points;

                    if (socket.opponent.hasConfirmedEnd) {
                        var emitter  = ROOM_LIST[socket.currentRoomName].emitter;
                        var receiver = ROOM_LIST[socket.currentRoomName].receiver;
                        var rounds   = ROOM_LIST[socket.currentRoomName].rounds;
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
                                    rounds         : rounds
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

                function playerReset (client) {
                    client.isReady         = false;
                    client.isInGame        = false;
                    client.hasConfirmedEnd = false;
                    client.opponent        = null;
                    client.playerActions   = {};
                    client.selectedCards   = [];
                    client.points          = -1;

                    delete client.playerInfo.deck;
                    client.leave(client.currentRoomName, function () {
                        console.log("Room", client.currentRoomName, "--", getClientName(client), "do playerReset");
                        client.currentRoomName = null;
                        client.emit("in:playerReset", {
                            status : "ok"
                        });
                    });
                }

                function onLogout (client) {
                    if (client.isInLounge) {
                        onLoungeLeave();
                    }
                    console.log(client.userId + " (" + client.ip + ") logged out.");
                    console.log("=======");

                    client.userId = null;
                    client.emit("in:logout", {
                        status : "ok"
                    });
                }

                function onLoungeLeave () {
                    socket.leave(LOUNGE_ROOM.name);
                    socket.isInLounge        = false;
                    socket.hasPendingRequest = false;
                    socket.canReceiveRequest = false;
                    console.log(socket.userId, "(" + socket.ip + ") left the lounge room. Players in the lounge:", LOUNGE_ROOM.length);

                    sendServiceMessage({
                        roomName   : LOUNGE_ROOM.name,
                        date       : new Date().toJSON(),
                        type       : "userLeft",
                        data       : {
                            userId: socket.userId
                        }
                    });

                    socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
                        status : "ok",
                        msg    : {
                            type   : "userLeft",
                            userId : socket.userId
                        }
                    });

                    io.emit("in:updateLoungeCount", {
                        status : "ok",
                        msg    : LOUNGE_ROOM.length
                    });

                    socket.emit("in:leaveLounge", {
                        status : "ok"
                    });
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

                function getClientName (client) {
                    return client.userId || client.ip;
                }

                function getClientByUserId (userId) {
                    return _.find(CLIENT_LIST, { userId: userId }) || null;
                }

                function getAllClientsOfUserId (userId) {
                    return _.filter(CLIENT_LIST, { userId: userId });
                }

                function getRoomMessageHistory (roomName) {
                    if (!ROOM_LIST[roomName]) {
                        return [];
                    } else {
                        return ROOM_LIST[roomName].messages;
                    }
                }

                function getRoomUserlist (roomName) {
                    if (!ROOM_LIST[roomName] || !ROOM_LIST[roomName].length) {
                        return {};
                    }

                    var client;
                    var userlist = {};
                    _.each(ROOM_LIST[roomName].sockets, function (clientStatus, clientId) {
                        client                  = CLIENT_LIST[clientId];
                        userlist[client.userId] = _.extend({}, client.playerInfo, {
                            isTyping   : client.typingInRoom === roomName,
                            opponentId : client.opponent ? client.opponent.userId : null
                        });
                    });

                    return userlist;
                }

                function getUID (length, usedList, base) {
                    length   = length || 32;
                    usedList = usedList || {};
                    base     = base || "";

                    var chars      = "0123456789abcdefghijklmnopqrstuvwxyz_";
                    var string     = "";
                    var charsCount = chars.length;

                    for (var i = 0; i < length; i++) {
                        string += chars[parseInt(Math.random() * charsCount)];
                    }

                    string = base + string;
                    return usedList[string] ? getUID(length, usedList) : string;
                }

                function leaveAllRooms (client, callback) {
                    var roomsLeft    = 0;
                    var roomsToLeave = _.filter(client.rooms, function (room, roomName) {
                        return (roomName !== client.id && roomName !== LOUNGE_ROOM.name);
                    });

                    if (!roomsToLeave.length && _.isFunction(callback)) {
                        callback();
                    } else {
                        // Leave all rooms but the client's private room and the lounge
                        _.each(roomsToLeave, function (room, roomName) {
                            client.leave(roomName, function () {
                                roomsLeft++;

                                if (roomsLeft === roomsToLeave.length && _.isFunction(callback)) {
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
    });
};
