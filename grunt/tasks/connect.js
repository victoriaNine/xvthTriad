module.exports = function (grunt, options) {
    var _                    = require("lodash");
    var lrSnippet            = require("connect-livereload")({ port: grunt.config("livereloadPort") });
    var path                 = require("path");
    var express              = require("express");
    var http                 = require("http");
    var fs                   = require("fs");
    var compression          = require("compression");
    var bodyParser           = require("body-parser");
    var logger               = require("morgan");
    var SuperLogin           = require("superlogin");
    var FacebookStrategy     = require("passport-facebook").Strategy;
    var PouchDB              = require("pouchdb");
    var CronJob              = require("cron").CronJob;
    var moment               = require("moment-timezone");
    var webpack              = require("webpack");
    var webpackDevMiddleware = require("webpack-dev-middleware");
    var wpConfig             = require(path.resolve(process.cwd(), "./webpack.config.js"));

    console.log(webpackConfig);


    grunt.registerTask("connect", function (target) {
        var port       = grunt.config("serverPort");
        var app        = express();
        var compiler   = webpack(wpConfig);
        var folder     = (target === "prod" || target === "beta") ? grunt.config("yeoman")[target] : grunt.config("yeoman").tmp;
        var protocol   = "http://"; //process.env.NODE_ENV === "prod" ? "https://" : "http://";
        var db         = new PouchDB(protocol + process.env.DB_USER + ":" + process.env.DB_PASS + "@" + process.env.DB_HOST + "/users");
        var saveConfig = { charOffset: process.env.SAVE_CHAR_OFFSET, charSeparator: process.env.SAVE_CHAR_SEPARATOR };
        var cronJobs   = {};
        var server;
        var ip;

        app.set("port", port);
        //app.use(logger("dev"));

        // Setup SuperLogin
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));

        // Redirect to https except on localhost
        //app.use(httpsRedirect);

        var config = {
            dbServer: {
                protocol: protocol,
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
                tokenLife: 24 * 60 * 60,
                sessionLife: 30 * 60,
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

        app.use(webpackDevMiddleware(compiler, {
            publicPath: wpConfig.output.publicPath
        }));
        //app.use(express.static(path.resolve(folder)));

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

            var K_FACTOR       = 32;
            var DAY_IN_MINUTES = 1440;
            var DAY_IN_SECONDS = 86400;
            var DAY_IN_MS      = 86400000;
            var DECAY_RATES    = [
                { days: 7, dailyPenalty: 1 },
                { days: 14, dailyPenalty: 2 },
                { days: 28, dailyPenalty: 5 },
                { days: 56, dailyPenalty: 10 }
            ];

            function findRate (daysSinceRG) {
                return _.find(_.reverse(DECAY_RATES.slice(0)), (rate) => { return rate.days <= daysSinceRG; });
            }

            var lastRankedGame, timeElapsed, userDoc, daysSinceRG, daysElapsed, decayRate, rankPoints, needsUpdate, i, ii;
            cronJobs.inactivityPenalty     = { job:null, result: null };
            cronJobs.inactivityPenalty.job = new CronJob({
                cronTime : "00 00 7 * * *", // Everyday at 7am (Paris)
                onTick   : function () {
                    var now = new Date();
                    db.query("auth/verifiedUsers", { include_docs: true }).then(function (result) {
                        _.each(result.rows, (user) => {
                            userDoc        = user.doc;
                            lastRankedGame = userDoc.profile.lastRankedGame;
                            daysSinceRG    = userDoc.profile.daysSinceRG;
                            rankPoints     = userDoc.profile.rankPoints;
                            timeElapsed    = now - lastRankedGame;
                            needsUpdate    = false;

                            //console.log(userDoc._id, lastRankedGame, daysSinceRG, rankPoints, timeElapsed);

                            if (lastRankedGame && timeElapsed >= DAY_IN_MS) {
                                daysElapsed = Math.floor(timeElapsed / DAY_IN_MS);

                                for (i = 0, ii = daysElapsed; i < ii; i++) {
                                    if (rankPoints < 0) {
                                        rankPoints = 0;
                                        break;
                                    }

                                    decayRate = findRate(++daysSinceRG);

                                    if (decayRate) {
                                        rankPoints -= decayRate.dailyPenalty * K_FACTOR;
                                    }
                                }

                                userDoc.profile.rankPoints  = rankPoints;
                                userDoc.profile.daysSinceRG = daysSinceRG;
                                needsUpdate = true;
                            } else if (daysSinceRG !== 0) {
                                userDoc.profile.daysSinceRG = 0;
                                needsUpdate = true;
                            }

                            if (needsUpdate) {
                                db.put(userDoc);
                            }
                        });
                    }).catch((error) => {
                        console.error("connect.js@167", error);
                    });
                },
                start    : true,
                timeZone : "Europe/Paris"
            });

            cronJobs.rankings     = { job: null, result: {} };
            cronJobs.rankings.job = new CronJob({
                cronTime : "00 00 7 * * *", // Every day at 7am (Paris)
                onTick   : function () {
                    /* TODO: Weekly update?
                    var from = moment().tz("Europe/Paris").day("monday").startOf("day");
                    var to   = moment().tz("Europe/Paris").day(+7).day("sunday").endOf("day");*/
                    var from = moment().tz("Europe/Paris").startOf("day").add(7, "hours");
                    var to   = moment().tz("Europe/Paris").startOf("day").add(1, "day").add(6, "hours").endOf("hour");

                    db.query("auth/verifiedUsers", { include_docs: true }).then((users) => {
                        var userDocs = _.map(users.rows, "doc");
                        var tenBest;

                        // "Ace of Cards" ranking
                        var sortedByElo = _.orderBy(userDocs, (userDoc) => { return userDoc.profile.rankPoints; }, "desc");
                        tenBest         = _.take(sortedByElo, 10);

                        var ranking_aceOfCards = _.map(tenBest, (userDoc) => {
                            var totalGames = userDoc.profile.gameStats.wonRanked + userDoc.profile.gameStats.lostRanked + userDoc.profile.gameStats.drawRanked;
                            var stats      = userDoc.profile.gameStats.wonRanked + " / " + totalGames;
                            var rate       = ((userDoc.profile.gameStats.wonRanked * 100 / totalGames) || 0).toFixed(2) + "%";

                            return {
                                name       : userDoc.name,
                                avatar     : userDoc.profile.avatar,
                                country    : userDoc.profile.country,
                                gameStats  : userDoc.profile.gameStats,
                                points     : userDoc.profile.rankPoints,
                                stats      : stats,
                                rate       : rate
                            };
                        });

                        while (ranking_aceOfCards.length < 10) {
                            ranking_aceOfCards.push({ filler: true });
                        }

                        cronJobs.rankings.result.aceOfCards = {
                            name   : "aceOfCards",
                            title  : "Ace of Cards",
                            date   : { from: from, to: to },
                            ranks  : ranking_aceOfCards,
                            sortBy : "points"
                        };

                        // "The Collector" ranking
                        var sortedByUnique = _.orderBy(userDocs, (userDoc) => { return _.uniqBy(userDoc.profile.album, "cardId").length; }, "desc");
                        tenBest            = _.take(sortedByUnique, 10);

                        var ranking_theCollector = _.map(tenBest, (userDoc) => {
                            return {
                                name       : userDoc.name,
                                avatar     : userDoc.profile.avatar,
                                country    : userDoc.profile.country,
                                albumSize  : userDoc.profile.album.length,
                                uniqueSize : _.uniqBy(userDoc.profile.album, "cardId").length
                            };
                        });

                        _.each(ranking_theCollector, (ranker) => {
                            var uniqueRate = ranker.uniqueSize * 100 / ranker.albumSize;
                            ranker.points  = Math.floor(ranker.uniqueSize * (100 - uniqueRate / 100));
                            ranker.stats   = ranker.albumSize;
                            ranker.rate    = ranker.uniqueSize;
                        });

                        ranking_theCollector = _.orderBy(ranking_theCollector, "points", "desc");

                        while (ranking_theCollector.length < 10) {
                            ranking_theCollector.push({ filler: true });
                        }

                        cronJobs.rankings.result.theCollector = {
                            name   : "theCollector",
                            title  : "The Collector",
                            date   : { from: from, to: to },
                            ranks  : ranking_theCollector,
                            sortBy : "points"
                        };
                    }).catch((error) => {
                        console.error("connect.js@254", error);
                    });
                },
                start     : true,
                timeZone  : "Europe/Paris",
                runOnInit : true
            });
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

                console.log(moment.tz("Europe/Paris").format("YYYY.MM.DD @ HH:mm:ss"), "-- A user connected (" + getClientName(socket) + "). Players online:", CLIENT_COUNT);
                console.log("=======");

                db.query("auth/verifiedUsers").then(function (result) {
                    socket.emit("in:socketReady", {
                        status : "ok",
                        msg    : result.total_rows
                    });
                }).catch((error) => {
                        console.error("connect.js@320", error);
                    });

                socket.on("disconnect", function () {
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
                    socket.join(LOUNGE_ROOM.name, proceed);

                    function proceed () {
                        socket.isInLounge        = true;
                        socket.playerInfo        = _.clone(userInfo);
                        socket.canReceiveRequest = true;
                        delete socket.playerInfo.isTyping;
                        delete socket.playerInfo.opponentId;
                        console.log(socket.userId, "(" + socket.ip + ") joined the lounge room. Players in the lounge:", LOUNGE_ROOM.length);

                        socket.broadcast.to(LOUNGE_ROOM.name).emit("in:updateUserlist", {
                            status : "ok",
                            msg  : {
                                type        : "userJoined",
                                userId      : socket.userId,
                                userInfo    : userInfo,
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
                            userId   : socket.userId,
                            userInfo : userInfo
                        }
                    });

                    socket.emit("in:rejoinLounge", {
                        status : "ok",
                        msg    : LOUNGE_ROOM.name
                    });
                });

                socket.on("out:leaveLounge", function () {
                    onLoungeLeave(socket);
                });

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

                socket.on("out:cancelChallenge", function (data) {
                    var opponent = getClientByUserId(data.to);

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

                socket.on("out:releasePending", function (data) {
                    socket.hasPendingRequest = false;

                    socket.emit("in:releasePending", {
                        status : "ok"
                    });
                });

                socket.on("out:setupChallengeRoom", function (data) {
                    var opponent  = getClientByUserId(data.with);
                    var roomName  = getUID(16, ROOM_LIST, LOUNGE_ROOM.name + "-");
                    var joinCount = 0;

                    leaveAllRooms(socket, function () {
                        leaveAllRooms(opponent, function () {
                            socket.join(roomName, function () { if (++joinCount === 2) { proceed(); } });
                            opponent.join(roomName, function () { if (++joinCount === 2) { proceed(); } });

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
                            }
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
                            if (!isFromSameBrowser(socket, newRoom.emitter)) {
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
                                        reason      : "sameBrowser",
                                        roomName    : roomName,
                                        emitterName : newRoom.emitter.playerInfo.name
                                    }
                                });
                            }
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

                socket.on("out:getRules", function (data) {
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

                socket.on("out:setElementBoard", function (data) {
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

                socket.on("out:getElementBoard", function (data) {
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

                socket.on("out:setFirstPlayer", function (data) {
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

                socket.on("out:getFirstPlayer", function (data) {
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

                socket.on("out:setPlayerAction", function (data) {
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

                socket.on("out:getPlayerAction", function (data) {
                    if (socket.opponent && ROOM_LIST[socket.currentRoomName] && !ROOM_LIST[socket.currentRoomName].hasEnded) {
                        var currentTurn = ROOM_LIST[socket.currentRoomName].currentTurn;

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

                socket.on("out:setSelectedCards", function (data) {
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

                socket.on("out:getSelectedCards", function (data) {
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

                    socket.emit("in:playerReset", {
                        status : "ok"
                    });
                });

                socket.on("out:roundReset", function () {
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

                socket.on("out:confirmReady", function (userDeck) {
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

                socket.on("out:cancelReady", function (data) {
                    console.log("Room", socket.currentRoomName, "--", getClientName(socket), "do cancelReady");
                    socket.isReady = false;

                    socket.emit("in:cancelReady", {
                        status : "ok"
                    });
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

                socket.on("out:getUser", function (data) {
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

                socket.on("out:encodeSaveData", function (data) {
                    var JSONdata    = JSON.stringify(data.JSONdata);
                    var prefix      = data.prefix;
                    var encodedData = prefix;

                    JSONdata.split("").forEach(function (char) {
                        encodedData += saveConfig.charSeparator + (char.codePointAt(0) + parseFloat(saveConfig.charOffset));
                    });

                    socket.emit("in:encodeSaveData", {
                        status : "ok",
                        msg    : encodedData
                    });
                });

                socket.on("out:decodeSaveData", function (data) {
                    var encodedData = data.encodedData;
                    var prefix      = data.prefix;
                    var JSONdata    = "";

                    encodedData.replace(prefix, "").match(new RegExp(saveConfig.charSeparator + "\\d+", "g")).forEach(function (chunk) {
                        JSONdata += String.fromCodePoint(chunk.match(/\d+/) - parseFloat(saveConfig.charOffset));
                    });

                    socket.emit("in:decodeSaveData", {
                        status : "ok",
                        msg    : JSON.parse(JSONdata)
                    });
                });

                socket.on("out:getRanking", function (data) {
                    var name    = data.msg.name;
                    var ranking = null;

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
                    if (clientA.handshake.address === clientB.handshake.address &&
                        clientA.handshake.headers["user-agent"] === clientB.handshake.headers["user-agent"]) {
                        return true;
                    } else {
                        return false;
                    }
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
