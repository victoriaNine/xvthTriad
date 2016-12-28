'use strict';
var _               = require('lodash');
var LIVERELOAD_PORT = 35729;
var SERVER_PORT     = 9000;
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
  // show elapsed time at the end
  require('time-grunt')(grunt);

  // Automatically load required Grunt tasks
  require('jit-grunt')(grunt, {
    useminPrepare: 'grunt-usemin'
  });

  // configurable paths
  var yeomanConfig = {
    app: 'app',
    dist: 'dist'
  };

  grunt.initConfig({
    yeoman: yeomanConfig,
    watch: {
      options: {
        nospawn: true,
        livereload: LIVERELOAD_PORT
      },
      livereload: {
        options: {
          livereload: grunt.option('livereloadport') || LIVERELOAD_PORT
        },
        files: [
          '<%= yeoman.app %>/*.html',
          '{.tmp,<%= yeoman.app %>}/css/{,*/}*.css',
          '{.tmp,<%= yeoman.app %>}/js/{,*/}*.js',
          '<%= yeoman.app %>/images/{,*/}*.{png,jpg,jpeg,gif,webp}',
          '<%= yeoman.app %>/js/templates/*.{ejs,mustache,hbs}',
          'test/spec/**/*.js'
        ]
      },
      jst: {
        files: [
          '<%= yeoman.app %>/js/templates/*.ejs'
        ],
        tasks: ['jst']
      },
      test: {
        files: ['<%= yeoman.app %>/js/{,*/}*.js', 'test/spec/**/*.js'],
        tasks: ['test:true']
      }
    },
    connect: {
      options: {
        port: grunt.option('port') || SERVER_PORT,
        // change this to '0.0.0.0' to access the server from outside
        hostname: 'localhost',
        onCreateServer: setupSocket
      },
      livereload: {
        options: {
          middleware: function (connect) {
            return [
              lrSnippet,
              mountFolder(connect, '.tmp'),
              mountFolder(connect, yeomanConfig.app)
            ];
          }
        }
      },
      test: {
        options: {
          port: 9001,
          middleware: function (connect) {
            return [
              mountFolder(connect, 'test'),
              lrSnippet,
              mountFolder(connect, '.tmp'),
              mountFolder(connect, yeomanConfig.app)
            ];
          }
        }
      },
      dist: {
        options: {
          middleware: function (connect) {
            return [
              mountFolder(connect, yeomanConfig.dist)
            ];
          }
        }
      }
    },
    open: {
      server: {
        path: 'http://localhost:<%= connect.options.port %>'
      },
      test: {
        path: 'http://localhost:<%= connect.test.options.port %>'
      }
    },
    clean: {
      dist: ['.tmp', '<%= yeoman.dist %>/*'],
      server: '.tmp'
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        '<%= yeoman.app %>/js/{,*/}*.js',
        '!<%= yeoman.app %>/js/vendor/*',
        'test/spec/{,*/}*.js'
      ]
    },
    mocha: {
      all: {
        options: {
          run: true,
          urls: ['http://localhost:<%= connect.test.options.port %>/index.html']
        }
      }
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
          baseUrl: '<%= yeoman.app %>/js',

          mainConfigFile: '<%= yeoman.app %>/js/main.js', // contains path specifications and nothing else important with respect to config

          keepBuildDir: true,
          dir: '.tmp/js',

          optimize: 'none', // optimize by uglify task
          useStrict: true,
          wrap: true

        }
      }
    },
    uglify: {
      dist: {
        files: {
          '<%= yeoman.dist %>/js/main.js': [
            '.tmp/js/main.js'
          ]
        }
      }
    },
    useminPrepare: {
      html: '<%= yeoman.app %>/index.html',
      options: {
        dest: '<%= yeoman.dist %>'
      }
    },
    usemin: {
      html: ['<%= yeoman.dist %>/{,*/}*.html'],
      css: ['<%= yeoman.dist %>/css/{,*/}*.css'],
      options: {
        dirs: ['<%= yeoman.dist %>']
      }
    },
    imagemin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/images',
          src: '{,*/}*.{png,jpg,jpeg}',
          dest: '<%= yeoman.dist %>/images'
        }]
      }
    },
    cssmin: {
      dist: {
        files: {
          '<%= yeoman.dist %>/css/main.css': [
            '.tmp/css/{,*/}*.css',
            '<%= yeoman.app %>/css/{,*/}*.css'
          ]
        }
      }
    },
    htmlmin: {
      dist: {
        options: {
          /*removeCommentsFromCDATA: true,
          // https://github.com/yeoman/grunt-usemin/issues/44
          //collapseWhitespace: true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeOptionalTags: true*/
        },
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>',
          src: '*.html',
          dest: '<%= yeoman.dist %>'
        }]
      }
    },
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= yeoman.app %>',
          dest: '<%= yeoman.dist %>',
          src: [
            '*.{ico,txt}',
            'images/{,*/}*.{webp,gif}',
            'css/fonts/{,*/}*.*',
          ]
        }, {
          src: 'node_modules/apache-server-configs/dist/.htaccess',
          dest: '<%= yeoman.dist %>/.htaccess'
        }]
      }
    },
    bower: {
      all: {
        rjsConfig: '<%= yeoman.app %>/js/main.js'
      }
    },
    jst: {
      options: {
        amd: true
      },
      compile: {
        files: {
          '.tmp/js/templates.js': ['<%= yeoman.app %>/js/templates/*.ejs']
        }
      }
    },
    rev: {
      dist: {
        files: {
          src: [
            '<%= yeoman.dist %>/js/{,*/}*.js',
            '<%= yeoman.dist %>/css/{,*/}*.css',
            '<%= yeoman.dist %>/images/{,*/}*.{png,jpg,jpeg,gif,webp}',
            '<%= yeoman.dist %>/css/fonts/{,*/}*.*',
          ]
        }
      }
    }
  });

  grunt.registerTask('createDefaultTemplate', function () {
    grunt.file.write('.tmp/js/templates.js', 'this.JST = this.JST || {};');
  });

  grunt.registerTask('server', function (target) {
    grunt.log.warn('The `server` task has been deprecated. Use `grunt serve` to start a server.');
    grunt.task.run(['serve' + (target ? ':' + target : '')]);
  });

  grunt.registerTask('serve', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build', 'open:server', 'connect:dist:keepalive', 'socketServer:dist']);
    }

    if (target === 'test') {
      return grunt.task.run([
        'clean:server',
        'createDefaultTemplate',
        'jst',
        'connect:test',
        'socketServer:test',
        'open:test',
        'watch'
      ]);
    }

    grunt.task.run([
      'clean:server',
      'createDefaultTemplate',
      'jst',
      'connect:livereload',
      //'open:server',
      'watch'
    ]);
  });

  grunt.registerTask('test', function (isConnected) {
    isConnected = Boolean(isConnected);
    var testTasks = [
        'clean:server',
        'createDefaultTemplate',
        'jst',
        'connect:test',
        'mocha'
      ];

    if(!isConnected) {
      return grunt.task.run(testTasks);
    } else {
      // already connected so not going to connect again, remove the connect:test task
      testTasks.splice(testTasks.indexOf('connect:test'), 1);
      return grunt.task.run(testTasks);
    }
  });

  grunt.registerTask('build', [
    'clean:dist',
    'createDefaultTemplate',
    'jst',
    'useminPrepare',
    'imagemin',
    'htmlmin',
    'concat',
    'sass',
    'cssmin',
    'requirejs',
    'uglify',
    'copy',
    'rev',
    'usemin'
  ]);

  grunt.registerTask('default', [
    //'jshint',
    //'test',
    'serve'
  ]);

  function setupSocket (server, connect, options) {
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

          console.log("transmitter --", socket.id, "set rules:", data);
          if (opponent) {
            console.log("transmitter --", socket.id, "send rules:", data);
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
          console.log("receiver --", socket.id, "get rules:", roomList[socket.currentRoom].rules);
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

          console.log("transmitter --", socket.id, "set firstPlayer:", data);
          if (opponent) {
            console.log("transmitter --", socket.id, "send firstPlayer:", data);
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
          console.log("receiver --", socket.id, "get firstPlayer:", roomList[socket.currentRoom].firstPlayer);
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

          console.log("turn", data.turnNumber,"-- playing:", socket.id, "set playerAction:", data);
          if (opponent) {
            console.log("turn", data.turnNumber,"-- playing:", socket.id, "send playerAction:", data);
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

          console.log("turn", currentTurn,"-- waiting:", socket.id, "get playerAction:", opponent.playerActions[currentTurn]);
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

          console.log(socket.id, "set selected cards:", data);
          if (opponent) {
            console.log(socket.id, "send selected cards:", data);
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

          console.log(socket.id, "get selected cards:", opponent.selectedCards);
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
          console.log(socket.id, "do playerReset");
          socket.currentRoom = null;
          socket.emit("in:playerReset", {
            type : "ok"
          });
        }, 1000);
      });

      socket.on("out:roundReset", function () {
        console.log("transmitter --", socket.id, "do roundReset");
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
        console.log(socket.id, "do confirmReady", data);
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
        console.log(socket.id, "do cancelReady");
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
