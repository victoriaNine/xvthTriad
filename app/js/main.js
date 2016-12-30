// Filename: main.js

// Require.js allows us to configure mappings to paths
// as demonstrated below:
require.config({
    baseUrl : "./js/",
    paths   : {
        jquery            : "libs/jquery/dist/jquery",
        backbone          : "libs/backbone/backbone",
        underscore        : "libs/lodash/dist/lodash",
        tweenMax          : "libs/gsap/src/uncompressed/TweenMax",
        seriously         : "libs/seriouslyjs/seriously",
        modernizr         : "libs/modernizr/modernizr",
        socketIO          : "libs/socket.io-client/dist/socket.io",
        stats             : "libs/stats.js/build/stats",

        text              : "libs/requirejs-plugins/lib/text",
        async             : "libs/requirejs-plugins/src/async",
        font              : "libs/requirejs-plugins/src/font",
        goog              : "libs/requirejs-plugins/src/goog",
        image             : "libs/requirejs-plugins/src/image",
        json              : "libs/requirejs-plugins/src/json",
        noext             : "libs/requirejs-plugins/src/noext",
        mdown             : "libs/requirejs-plugins/src/mdown",
        propertyParser    : "libs/requirejs-plugins/src/propertyParser",
        markdownConverter : "libs/requirejs-plugins/lib/Markdown.Converter",

        jqueryNearest     : "libs/jquery-nearest/src/jquery.nearest",
        es6Promise        : "libs/es6-promise/es6-promise",
        fetch             : "libs/fetch/fetch",
        storage           : "libs/backbone/backbone.localStorage",

        global            : "global"
    },

    shim   : {
        jqueryNearest     : ["jquery"]
    }
});

require([
    "modernizr",
    "jquery",
    "underscore",
    "tweenMax",
    "socketIO",
    "stats",
    "modules/audioEngine",
    "modules/canvasWebGL",
    "modules/assetLoader",
    "modules/gamepadManager",
    "modules/updateManager",
    "modules/socketManager",
    "json!data/loader_imgUI.json",
    "json!data/loader_imgAvatars.json",
    "json!data/loader_imgCards.json",
    "json!data/loader_audioBGM.json",
    "json!data/loader_audioSFX.json",
    "global",
    "views/elem_footer",
    "views/screen",
    "views/screen_cardSelect",
    "views/screen_game",
    "views/screen_loading",
    "views/screen_roomSelect",
    "views/screen_rulesSelect",
    "views/screen_title",
    "views/screen_userSettings",
    "views/screen_overlayAbout",
    "views/screen_overlayMenu",
    "jqueryNearest"
], function (Modernizr, $, _, tweenMax, SocketIO, Stats, AudioEngine, CanvasWebGL, AssetLoader, GamepadManager, UpdateManager, SocketManager, loaderImgUI, loaderImgAvatars, loaderImgCards, loaderAudioBGM, loaderAudioSFX, _$, Elem_Footer) {
    var Screen_Loading = require("views/screen_loading");
    var Screen_Title   = require("views/screen_title");
    var loaders        = [loaderAudioBGM, loaderAudioSFX, loaderImgUI, loaderImgAvatars, loaderImgCards];

    function setupScale () {
        var ORIGINAL_SIZE = {
            width  : 1920,
            height : 950
        };

        function pixelRatioAdjust (forceSize) {
            var html             = document.querySelector("html");
            var body             = document.body;
            var devicePixelRatio = window.devicePixelRatio = window.devicePixelRatio || 1;

            window.screen       = window.screen || {};
            screen.actualWidth  = window.screen.width * devicePixelRatio;
            screen.actualHeight = window.screen.height * devicePixelRatio;

            var scalar           = 1 / devicePixelRatio;
            var offset           = (devicePixelRatio * 100 - 100) / 2;

            if (forceSize) {
                html.style.transformOrigin = "0 0";
                _$.events.on("scalarUpdate", function (event, newScalar) {
                    _$.state.appScalar = newScalar;
                });
                window.addEventListener("resize", reScale);
                reScale();
            } else {
                html.style.width   = window.innerWidth * devicePixelRatio + "px";
                html.style.height  = window.innerHeight * devicePixelRatio + "px";
                _$.state.appScalar = 1;
            }

            body.style.transform = "scale(" + scalar + ") translate(-" + offset + "%, -" + offset + "%)";

            function reScale () {
                var fullWidth  = window.innerWidth * devicePixelRatio;
                var fullHeight = window.innerHeight * devicePixelRatio;
                var scalarW = fullWidth / ORIGINAL_SIZE.width;
                var scalarH = fullHeight / ORIGINAL_SIZE.height;
                var scalar;

                if (scalarW < scalarH) {
                    scalar = scalarW;
                    html.style.width  = ORIGINAL_SIZE.width + "px";
                    html.style.height = ((window.innerHeight * devicePixelRatio) / scalar) + "px";
                } else {
                    scalar = scalarH;
                    html.style.width  = ((window.innerWidth * devicePixelRatio) / scalar) + "px";
                    html.style.height = ORIGINAL_SIZE.height + "px";
                }

                html.style.transform = "scale(" + scalar + ")";
                _$.events.trigger("scalarUpdate", scalar);
            }
        }

        pixelRatioAdjust(true);
    }

    function setupStats () {
        var stats = new Stats();
        stats.dom.style.left = "auto";
        stats.dom.style.right = "0px";
        stats.dom.style.width = "80px";
        stats.showPanel(0);
        document.body.appendChild(stats.dom);

        requestAnimationFrame(function loop () {
            stats.update();
            requestAnimationFrame(loop);
        });
    }

    if (!_$.debug.debugMode) {
        //===============================
        // GOOGLE ANALYTICS
        //===============================
        (function(b,o,i,l,e,r){
            b.GoogleAnalyticsObject=l;b[l]||(b[l]=function(){(b[l].q=b[l].q||[]).push(arguments)});b[l].l=+new Date;
            e=o.createElement(i);r=o.getElementsByTagName(i)[0];
            e.src="//www.google-analytics.com/analytics.js";
            r.parentNode.insertBefore(e,r);
        }(window,document,"script","ga"));
        ga("create","UA-89445990-1");
        ga("send","pageview");
    }

    if (window.location.pathname !== "/") {
        history.replaceState({}, "", "/");
    }
    
    TweenMax.set(_$.dom, { opacity : 0 });
    setupScale();

    if (_$.debug.debugMode) {
        setupStats();
    }

    _$.events.on("all", function (eventName, ...data) {
        if (data.length) {
            _$.debug.log("event triggered:", eventName, data);
        } else {
            _$.debug.log("event triggered:", eventName);
        }
    });

    _$.events.once("launch", function () {
        _$.comm.socketManager = new SocketManager();
        _$.ui.footer          = new Elem_Footer();
        _$.ui.screen          = new Screen_Title({ setup: true, fullIntro: true });

        $(window).on("beforeunload", function (e) {
            return _$.ui.screen.showSavePrompt(e);
        }).on("blur", function() {
            _$.audio.audioEngine.channels.master.fadeOut();
        }).on("focus", function() {
            _$.audio.audioEngine.channels.master.fadeIn({ to: 1 });
        });
    });

    _$.events.on("gamepadOn",  () => { _$.controls.type = "gamepad"; });
    _$.events.on("gamepadOff", () => { _$.controls.type = "mouse"; });

    _$.controls.type           = "mouse";
    _$.controls.gamepadManager = new GamepadManager();
    _$.app.updateManager       = new UpdateManager();
    _$.app.assetLoader         = new AssetLoader();
    _$.audio.audioEngine       = new AudioEngine();
    _$.ui.canvas               = new CanvasWebGL();
    _$.ui.screen               = new Screen_Loading();

    _$.app.assetLoader.load(loaders);
});
