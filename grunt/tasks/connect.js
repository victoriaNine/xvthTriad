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
        var port   = grunt.config("serverPort");
        var app    = express();
        var folder = (target === "beta" || target === "dist") ? grunt.config("yeoman")[target] : grunt.config("yeoman").tmp;
        var server;
        var ip;

        app.set("port", port);
        app.use(logger("dev"));

        // Setup SuperLogin
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
 
        // Redirect to https except on localhost
        //app.use(httpsRedirect);

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
                fromEmail: process.env.MAILER_NAME + "<" + process.env.MAILER_EMAIL + ">",
                options: "smtps://" + encodeURIComponent(process.env.MAILER_EMAIL) + ":" + process.env.MAILER_PASSWORD + "@" + process.env.MAILER_SMTP
            },
            security: {
                maxFailedLogins: 3,
                lockoutTime: 600,
                tokenLife: 86400
            },
            local: {
                sendConfirmEmail: true,
                requireEmailConfirm: false,
                loginOnRegistration: true,
                confirmEmailRedirectURL: "/confirm-email"
            },
            /*userDBs: {
                defaultDBs: {
                    private: ["user"]
                }
            },*/
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

        var Profile = require("../parsers/profile");
        var profile = new Profile(superlogin);

        app.get("/user/profile", superlogin.requireAuth, function(req, res, next) {
          profile.get(req.user._id)
            .then(function(userProfile) {
              res.status(200).json(userProfile);
            }, function(err) {
              return next(err);
            });
        });

        app.post("/user/change-name", superlogin.requireAuth, function(req, res, next) {
          if(!req.body.newName) {
            return next({
              error: "Field \"newName\" is required",
              status: 400
            });
          }
          profile.changeName(req.user._id, req.body.newName)
            .then(function(userProfile) {
              res.status(200).json(userProfile);
            }, function(err) {
              return next(err);
            });
        });

        app.post("/user/destroy", superlogin.requireAuth, function(req, res, next) {
          superlogin.removeUser(req.user._id, true)
            .then(function() {
              console.log("User destroyed!");
              res.status(200).json({ok: true, success: "User: " + req.user._id + " destroyed."});
            }, function(err) {
              return next(err);
            });
        });

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
            var io          = require("socket.io").listen(server);
            var clientCount = 0;
            var clientList;
            var roomList;

            io.sockets.on("connection", function (socket) {
                socket.currentRoom   = null;
                socket.isReady       = false;
                socket.isPlaying     = false;
                socket.hasConfirmed  = false;
                socket.playerInfo    = null;
                socket.playerActions = {};
                socket.selectedCards = null;
                socket.ip            = socket.request.headers["x-forwarded-for"] || socket.request.connection.remoteAddress;
                clientList           = io.sockets.connected;
                roomList             = io.sockets.adapter.rooms;

                console.log("a user connected (" + socket.ip + "). ongoing sessions:", ++clientCount);
                console.log("=======");

                socket.on("disconnect", function () {
                    console.log("a user disconnected (" + socket.ip + "). ongoing sessions:", --clientCount);
                    console.log("=======");

                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var roomClients = roomList[socket.currentRoom].sockets;
                        console.log("room", socket.currentRoom, "--", socket.ip, "disconnected.");
                        io.to(socket.currentRoom).emit("in:otherPlayerLeft", {
                            type : "error",
                            msg  : "Connection with the other player lost."
                        });

                        _.each(roomClients, function (client, clientName) {
                            clientList[clientName].leave(socket.currentRoom);
                            clientList[clientName].currentRoom = null;
                        });
                    }
                });

                socket.on("out:createRoom", function (data) {
                    var newRoom = roomList[data.roomName];
                    if (newRoom) {
                        socket.emit("in:createRoom", {
                            type : "error",
                            msg  : "Room " + data.roomName + " already exists. Please choose another name."
                        });
                    } else {
                        leaveAllRooms();

                        setTimeout(function () {
                            socket.currentRoom = data.roomName;
                            console.log("room", socket.currentRoom, "--", socket.ip, "do createRoom");

                            socket.join(socket.currentRoom);
                            socket.emit("in:createRoom", {
                                type : "ok"
                            });
                        }, 1000);
                    }
                });

                socket.on("out:joinRoom", function (data) {
                    var newRoom = roomList[data.roomName];
                    if (newRoom) {
                        if (newRoom.length < 2) {
                            leaveAllRooms();

                            setTimeout(function () {
                                if (newRoom.length < 2) {
                                    socket.currentRoom = data.roomName;
                                    console.log("room", socket.currentRoom, "--", socket.ip, "do joinRoom");

                                    socket.join(socket.currentRoom);
                                    socket.emit("in:joinRoom", {
                                        type : "ok"
                                    });
                                } else {
                                    socket.emit("in:joinRoom", {
                                        type : "error",
                                        msg  : "Room " + data.roomName + " is already full."
                                    });
                                }
                            }, 1000);
                        } else {
                            socket.emit("in:joinRoom", {
                                type : "error",
                                msg  : "Room " + data.roomName + " is already full."
                            });
                        }
                    } else {
                        socket.emit("in:joinRoom", {
                            type : "error",
                            msg  : "Room " + data.roomName + " doesn't exist."
                        });
                    }
                });

                socket.on("out:leaveRoom", function (data) {
                    socket.leave(socket.currentRoom);

                    setTimeout(function () {
                        console.log("room", socket.currentRoom, "--", socket.ip, "do leaveRoom");
                        socket.currentRoom = null;
                        socket.emit("in:leaveRoom", {
                            type : "ok"
                        });
                    }, 1000);
                });

                socket.on("out:setRules", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent = clientList[getOpponentId()];
                        roomList[socket.currentRoom].rules = data;

                        console.log("room", socket.currentRoom, "-- transmitter --", socket.ip, "set rules:", data);
                        if (opponent) {
                            console.log("room", socket.currentRoom, "-- transmitter --", socket.ip, "send rules:", data);
                            io.to(getOpponentId()).emit("in:getRules", {
                                type : "ok",
                                msg  : data
                            });
                        }

                        socket.emit("in:setRules", {
                             type : "ok"
                        });
                    } else {
                        socket.emit("in:setRules", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:getRules", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        console.log("room", socket.currentRoom, "-- receiver --", socket.ip, "get rules:", roomList[socket.currentRoom].rules);
                        socket.emit("in:getRules", {
                            type : "ok",
                            msg  : roomList[socket.currentRoom].rules
                        });
                    } else {
                        socket.emit("in:getRules", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:setFirstPlayer", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent = clientList[getOpponentId()];
                        roomList[socket.currentRoom].firstPlayer = data;

                        console.log("room", socket.currentRoom, "-- transmitter --", socket.ip, "set firstPlayer:", data);
                        if (opponent) {
                            console.log("room", socket.currentRoom, "-- transmitter --", socket.ip, "send firstPlayer:", data);
                            io.to(getOpponentId()).emit("in:getFirstPlayer", {
                                type : "ok",
                                msg  : data
                            });
                        }

                        socket.emit("in:setFirstPlayer", {
                            type : "ok"
                        });
                    } else {
                        socket.emit("in:setFirstPlayer", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:getFirstPlayer", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        console.log("room", socket.currentRoom, "-- receiver --", socket.ip, "get firstPlayer:", roomList[socket.currentRoom].firstPlayer);
                        socket.emit("in:getFirstPlayer", {
                            type : "ok",
                            msg  : roomList[socket.currentRoom].firstPlayer
                        });
                    } else {
                        socket.emit("in:getFirstPlayer", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:setPlayerAction", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent                             = clientList[getOpponentId()];
                        roomList[socket.currentRoom].currentTurn = data.turnNumber;
                        socket.playerActions[data.turnNumber]    = data;

                        console.log("room", socket.currentRoom, "-- turn", data.turnNumber,"-- playing:", socket.ip, "set playerAction:", data);
                        if (opponent) {
                            console.log("room", socket.currentRoom, "-- turn", data.turnNumber,"-- playing:", socket.ip, "send playerAction:", data);
                            io.to(getOpponentId()).emit("in:getPlayerAction", {
                                type : "ok",
                                msg  : data
                            });
                        }

                        socket.emit("in:setPlayerAction", {
                            type : "ok"
                        });
                    } else {
                        socket.emit("in:setPlayerAction", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:getPlayerAction", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent    = clientList[getOpponentId()];
                        var currentTurn = roomList[socket.currentRoom].currentTurn;

                        console.log("room", socket.currentRoom, "-- turn", currentTurn,"-- waiting:", socket.ip, "get playerAction:", opponent.playerActions[currentTurn]);
                        socket.emit("in:getPlayerAction", {
                             type : "ok",
                             msg  : opponent.playerActions[currentTurn]
                        });
                    } else {
                        socket.emit("in:getPlayerAction", {
                            type : "error",
                             msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:setSelectedCards", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent         = clientList[getOpponentId()];
                        socket.selectedCards = data;

                        console.log("room", socket.currentRoom, "--", socket.ip, "set selected cards:", data);
                        if (opponent) {
                            console.log("room", socket.currentRoom, "--", socket.ip, "send selected cards:", data);
                            io.to(getOpponentId()).emit("in:getSelectedCards", {
                            type : "ok",
                                msg  : data
                            });
                        }

                        socket.emit("in:setSelectedCards", {
                            type : "ok"
                        });
                    } else {
                        socket.emit("in:setSelectedCards", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:getSelectedCards", function (data) {
                    if (socket.currentRoom && roomList[socket.currentRoom]) {
                        var opponent = clientList[getOpponentId()];

                        console.log("room", socket.currentRoom, "--", socket.ip, "get selected cards:", opponent.selectedCards);
                        socket.emit("in:getSelectedCards", {
                            type : "ok",
                            msg  : opponent.selectedCards
                        });
                    } else {
                        socket.emit("in:getSelectedCards", {
                            type : "error",
                            msg  : "No room was created for the game"
                        });
                    }
                });

                socket.on("out:playerReset", function () {
                    socket.leave(socket.currentRoom);
                    socket.isReady       = false;
                    socket.isPlaying     = false;
                    socket.hasConfirmed  = false;
                    socket.playerInfo    = null;
                    socket.playerActions = {};
                    socket.selectedCards = null;

                    setTimeout(function () {
                        console.log("room", socket.currentRoom, "--", socket.ip, "do playerReset");
                        socket.currentRoom = null;
                        socket.emit("in:playerReset", {
                            type : "ok"
                        });
                    }, 1000);
                });

                socket.on("out:roundReset", function () {
                    console.log("room", socket.currentRoom, "-- transmitter --", socket.ip, "do roundReset");
                    roomList[socket.currentRoom].currentTurn  = -1;
                    roomList[socket.currentRoom].firstPlayer  = null;
                    socket.playerActions                      = {};
                    clientList[getOpponentId()].playerActions = {};

                    socket.emit("in:roundReset", {
                        type : "ok"
                    });
                });

                socket.on("out:emitEventToClient", function (data) {
                    io.to(data.toClient).emit("in:emitEventToClient", data);
                });

                socket.on("out:emitEventToOpponent", function (data) {
                    io.to(getOpponentId()).emit("in:emitEventToOpponent", data);
                });

                socket.on("out:confirmReady", function (data) {
                    console.log("room", socket.currentRoom, "--", socket.ip, "do confirmReady", data);
                    var opponent      = clientList[getOpponentId()];
                    socket.isReady    = true;
                    socket.playerInfo = data;

                    if (opponent && opponent.isReady && roomList[socket.currentRoom].length === 2) {
                        socket.isPlaying   = true;
                        opponent.isPlaying = true;

                        console.log("room", socket.currentRoom, "-- players ready", socket.playerInfo, opponent.playerInfo);
                        socket.emit("in:confirmReady", opponent.playerInfo);
                        io.to(getOpponentId()).emit("in:confirmReady", socket.playerInfo);
                    }
                });

                socket.on("out:cancelReady", function (data) {
                    console.log("room", socket.currentRoom, "--", socket.ip, "do cancelReady");
                    socket.isReady = false;
                });

                socket.on("out:confirmEnd", function (data) {
                    var opponent        = clientList[getOpponentId()];
                    socket.hasConfirmed = true;

                    if (opponent.hasConfirmed) {
                        socket.emit("in:confirmEnd");
                        io.to(getOpponentId()).emit("in:confirmEnd");
                    }
                });

                function getOpponentId (data) {
                    var roomClients = roomList[socket.currentRoom].sockets;
                    var id;

                    _.find(roomClients, function (client, clientName) {
                        if (clientName !== socket.id) {
                            id = clientName;
                            return true;
                        }
                    });

                    return id;
                }

                function leaveAllRooms () {
                    // Leave all rooms but the client's private room
                    _.each(socket.rooms, function (room, roomName) {
                        if (roomName !== socket.id) {
                            socket.leave(roomName);
                        }
                    });
                }
            });
        }
    });
};
