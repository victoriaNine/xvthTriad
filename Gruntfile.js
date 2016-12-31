'use strict';
var LIVERELOAD_PORT = 35729;
var SERVER_PORT     = 9000;
var _               = require('lodash');
var lrSnippet       = require('connect-livereload')({port: LIVERELOAD_PORT});
var mountFolder     = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to match all subfolders:
// 'test/spec/**/*.js'
// templateFramework: 'lodash'

module.exports = function (grunt) {
  // Automatically load required Grunt tasks
  require('load-grunt-tasks')(grunt);

  // show elapsed time at the end
  require('time-grunt')(grunt);

  // configurable paths
  var pkgFile      = grunt.file.readJSON('package.json');
  var yeomanConfig = {
    app  : 'app',
    dist : 'dist',
    tmp  : '.tmp',
    beta : 'beta',
    prod : 'html'
  };

  grunt.initConfig({
    pkg   : pkgFile,
    yeoman: yeomanConfig,
    watch: {
      sass: {
        files: ['<%= yeoman.app %>/css/{,*/}*.scss'],
        tasks: ['newer:sass:server','newer:copy:server']
      },
      livereload: {
        options: {
          nospawn: true,
          livereload: grunt.option('livereloadport') || LIVERELOAD_PORT
        },
        files: [
          '<%= yeoman.app %>/*.html',
          '<%= yeoman.app %>/css/{,*/}*.css',
          '<%= yeoman.app %>/js/{,*/}*.js',
          '<%= yeoman.app %>/assets/img/{,*/}*.{png,jpg,jpeg,gif,webp}',
          '<%= yeoman.app %>/assets/svg/{,*/}*.svg',
          '<%= yeoman.app %>/js/templates/*.{html,ejs,mustache,hbs}'
        ],
        tasks: ['newer:copy:server','newer:string-replace:server']
      }
    },
    connect: {
      options: {
        port: grunt.option('port') || SERVER_PORT,
        // change this to '0.0.0.0' to access the server from outside
        hostname: '127.0.0.1',
        onCreateServer: setupSockets
      },
      livereload: {
        options: {
          middleware: function (connect) {
            var middlewares = [];

            middlewares.push(lrSnippet);
            middlewares.push(mountFolder(connect, yeomanConfig.tmp));

            // ***
            // Not found - just serve index.html
            // ***
            middlewares.push(function (req, res) {
              var file = yeomanConfig.tmp + '/index.html'; 
              if (grunt.file.exists(file)) {
                require('fs').createReadStream(file).pipe(res);
                return; // we're done
              }

              res.statusCode = 404; // where's index.html?
              res.end();
            });

            return middlewares;
          }
        }
      },
      dist: {
        options: {
          middleware: function (connect) {
            var middlewares = [];

            middlewares.push(mountFolder(connect, yeomanConfig.tmp));

            // ***
            // Not found - just serve index.html
            // ***
            middlewares.push(function (req, res) {
              var file = yeomanConfig.tmp + '/index.html'; 
              if (grunt.file.exists(file)) {
                require('fs').createReadStream(file).pipe(res);
                return; // we're done
              }

              res.statusCode = 404; // where's index.html?
              res.end();
            });

            return middlewares;
          }
        }
      },
      prod: {
        options: {
          middleware: function (connect) {
            var middlewares = [];

            middlewares.push(lrSnippet);
            middlewares.push(mountFolder(connect, yeomanConfig.prod));

            // ***
            // Not found - just serve index.html
            // ***
            middlewares.push(function (req, res) {
              var file = yeomanConfig.prod + '/index.html'; 
              if (grunt.file.exists(file)) {
                require('fs').createReadStream(file).pipe(res);
                return; // we're done
              }

              res.statusCode = 404; // where's index.html?
              res.end();
            });

            return middlewares;
          }
        }
      },
      beta: {
        options: {
          middleware: function (connect) {
            var middlewares = [];
            middlewares.push(mountFolder(connect, yeomanConfig.beta));

            // ***
            // Not found - just serve index.html
            // ***
            middlewares.push(function (req, res) {
              var file = yeomanConfig.beta + '/index.html'; 
              if (grunt.file.exists(file)) {
                require('fs').createReadStream(file).pipe(res);
                return; // we're done
              }

              res.statusCode = 404; // where's index.html?
              res.end();
            });

            return middlewares;
          }
        }
      }
    },
    open: {
      server: {
        path: 'http://localhost:<%= connect.options.port %>'
      }
    },
    clean: {
      buildPre: ['<%= yeoman.tmp %>', '<%= yeoman.dist %>'],
      buildPost: ['<%= yeoman.dist %>/js/*', '!<%= yeoman.dist %>/js/build.min.js*'],
      server: '<%= yeoman.tmp %>',
      build: '<%= yeoman.dist %>'
    },
    requirejs: {
      dist: {
        // Options: https://github.com/jrburke/r.js/blob/master/build/example.build.js
        options: {
          almond: true,

          replaceRequireScript: [{
            files: ['<%= yeoman.dist %>/index.html'],
            module: 'main'
          }],

          modules: [{name: 'main'}],
          baseUrl: '<%= yeoman.dist %>/js',

          mainConfigFile: '<%= yeoman.dist %>/js/main.js', // contains path specifications and nothing else important with respect to config

          keepBuildDir: true,
          dir: '<%= yeoman.dist %>/js',

          optimize: 'none', // optimize by uglify task
          useStrict: false,
          wrap: true,
          allowSourceOverwrites: true
        }
      }
    },
    babel: {
      options: {
        sourceMap: true,
        presets: ['es2015']
      },
      dist: {
          files: {
              '<%= yeoman.dist %>/js/build.js': '<%= yeoman.dist %>/js/main.js'
          }
      }
    },
    uglify: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          '<%= yeoman.dist %>/js/build.min.js': [
            '<%= yeoman.dist %>/js/build.js'
          ]
        }
      }
    },
    'string-replace': {
      server: {
        src: '<%= yeoman.tmp %>/js/global.js',
        dest: '<%= yeoman.tmp %>/js/global.js',
        options: {
          replacements: [
            {
              pattern: '{{ VERSION }}',
              replacement: '<%= pkg.version %>'
            },
            {
              pattern: '{{ VERSION_NAME }}',
              replacement: '<%= pkg.versionName %>'
            }
          ]
        }
      },
      build: {
        src: '<%= yeoman.app %>/js/global.js',
        dest: '<%= yeoman.dist %>/js/global.js',
        options: {
          replacements: [
            {
              pattern: /debugMode\s*?:\s*?.*\,/ig,
              replacement: 'debugMode: false,'
            },
            {
              pattern: '{{ VERSION }}',
              replacement: '<%= pkg.version %>'
            },
            {
              pattern: '{{ VERSION_NAME }}',
              replacement: '<%= pkg.versionName %>'
            }
          ]
        }
      }
    },
    usemin: {
      html: ['<%= yeoman.dist %>/{,*/}*.html'],
      options: {
        dirs: ['<%= yeoman.dist %>']
      }
    },
    cssmin: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          '<%= yeoman.dist %>/css/build.min.css': [
            '<%= yeoman.app %>/css/main.css'
          ]
        }
      }
    },
    copy: {
      server: {
        expand: true,
        dot: true,
        cwd: '<%= yeoman.app %>',
        src: ['**'],
        dest: '<%= yeoman.tmp %>'
      },
      dist: {
        expand: true,
        dot: true,
        cwd: '<%= yeoman.dist %>',
        dest: '<%= yeoman.tmp %>',
        src: ['**']
      },
      build: {
        files: [
          {
            expand: true,
            dot: true,
            cwd: '<%= yeoman.app %>',
            src: ['**', '!css/**'],
            dest: '<%= yeoman.dist %>'
          },
          {
            src: 'node_modules/apache-server-configs/dist/.htaccess',
            dest: '<%= yeoman.dist %>/.htaccess'
          }
        ]
      }
    },
    sass: {
      options: {
        style: 'nested',
        noCache: true
      },
      server: {
        files: {
          '<%= yeoman.app %>/css/main.css': '<%= yeoman.app %>/css/main.scss'
        }
      }
    }
  });

  grunt.registerTask('buildCardImgLoader', function (target) {
    var cardList = grunt.file.readJSON(yeomanConfig.app + '/js/data/cardList.json');
    var fileList = _.map(cardList, function (card) {
      return {
        "type" : "img.cards",
        "name" : _.camelCase(card.name) + ".png"
      };
    });

    var cardImgLoader = {
      "name"  : "imgCards",
      "files" : fileList
    };

    grunt.file.write(yeomanConfig.app + '/js/data/loader_imgCards.json', JSON.stringify(cardImgLoader, null, '\t')); 
  });

  grunt.registerTask('server', function (target) {
    grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
    grunt.task.run(['serve' + (target ? ':' + target : '')]);
  });

  grunt.registerTask('serve', function (target) {
    if (target === 'prod' || target === 'beta') {
      return grunt.task.run([
        'connect:' + target + ':keepalive'
      ]);
    }

    if (target === 'dist') {
      return grunt.task.run([
        'clean:server',
        'copy:dist',
        'open:server',
        'connect:dist:keepalive'
      ]);
    }

    var defaultTasks = [
      'clean:server',
      'sass:server',
      'buildCardImgLoader',
      'copy:server',
      'string-replace:server',
      'connect:livereload',
      //'open:server',
      'watch'
    ];

    if (target === 'justConnect') {
      defaultTasks = defaultTasks.slice(-2);
    }

    grunt.task.run(defaultTasks);
  });

  grunt.registerTask('build', [
    'clean:buildPre',
    'sass:server',
    'buildCardImgLoader',
    'copy:build',
    'cssmin',
    'string-replace:build',
    'requirejs',
    'babel',
    'uglify',
    'usemin',
    'clean:buildPost'
  ]);

  grunt.registerTask('default', [
    'serve'
  ]);

  function setupSockets (server, connect, options) {
    var io          = require("socket.io").listen(server);
    var clientCount = 0;
    var clientList;
    var roomList;

    io.sockets.on("connection", function (socket) {
      console.log("a user connected. ongoing sessions:", ++clientCount);
      console.log("=======");
      socket.currentRoom   = null;
      socket.isReady       = false;
      socket.isPlaying     = false;
      socket.hasConfirmed  = false;
      socket.playerInfo    = null;
      socket.playerActions = {};
      socket.selectedCards = null;
      clientList           = io.sockets.connected;
      roomList             = io.sockets.adapter.rooms;

      socket.on("disconnect", function () {
        console.log("a user disconnected. ongoing sessions:", --clientCount);
        console.log("=======");

        if (socket.currentRoom && roomList[socket.currentRoom]) {
          var roomClients = roomList[socket.currentRoom].sockets;
          console.log("room", socket.currentRoom, "--", socket.id, "disconnected.");
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
            console.log("room", socket.currentRoom, "--", socket.id, "do createRoom");

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
                console.log("room", socket.currentRoom, "--", socket.id, "do joinRoom");

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
          console.log("room", socket.currentRoom, "--", socket.id, "do leaveRoom");
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

          console.log("room", socket.currentRoom, "-- transmitter --", socket.id, "set rules:", data);
          if (opponent) {
            console.log("room", socket.currentRoom, "-- transmitter --", socket.id, "send rules:", data);
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
          console.log("room", socket.currentRoom, "-- receiver --", socket.id, "get rules:", roomList[socket.currentRoom].rules);
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

          console.log("room", socket.currentRoom, "-- transmitter --", socket.id, "set firstPlayer:", data);
          if (opponent) {
            console.log("room", socket.currentRoom, "-- transmitter --", socket.id, "send firstPlayer:", data);
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
          console.log("room", socket.currentRoom, "-- receiver --", socket.id, "get firstPlayer:", roomList[socket.currentRoom].firstPlayer);
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

          console.log("room", socket.currentRoom, "-- turn", data.turnNumber,"-- playing:", socket.id, "set playerAction:", data);
          if (opponent) {
            console.log("room", socket.currentRoom, "-- turn", data.turnNumber,"-- playing:", socket.id, "send playerAction:", data);
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

          console.log("room", socket.currentRoom, "-- turn", currentTurn,"-- waiting:", socket.id, "get playerAction:", opponent.playerActions[currentTurn]);
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

          console.log("room", socket.currentRoom, "--", socket.id, "set selected cards:", data);
          if (opponent) {
            console.log("room", socket.currentRoom, "--", socket.id, "send selected cards:", data);
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

          console.log("room", socket.currentRoom, "--", socket.id, "get selected cards:", opponent.selectedCards);
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
          console.log("room", socket.currentRoom, "--", socket.id, "do playerReset");
          socket.currentRoom = null;
          socket.emit("in:playerReset", {
            type : "ok"
          });
        }, 1000);
      });

      socket.on("out:roundReset", function () {
        console.log("room", socket.currentRoom, "-- transmitter --", socket.id, "do roundReset");
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
        console.log("room", socket.currentRoom, "--", socket.id, "do confirmReady", data);
        var opponent = clientList[getOpponentId()];
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
        console.log("room", socket.currentRoom, "--", socket.id, "do cancelReady");
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
};
