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
        draggable         : "libs/gsap/src/uncompressed/utils/Draggable",
        seriously         : "libs/seriouslyjs/seriously",

        storage           : "libs/backbone/backbone.localStorage",

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

        jqueryNearest      : "libs/jquery-nearest/src/jquery.nearest",
        "es6-promise"      : "libs/es6-promise/es6-promise",
        "fetch"            : "libs/fetch/fetch",
        aggregation        : "libs/aggregation/src/aggregation-es6",

        global             : "global"
    },

    shim: {
        jqueryNearest : ["jquery"],
    }
});

require([
    "jquery",
    "underscore",
    "modules/audioEngine",
    "modules/canvasWebGL",
    "modules/assetLoader",
    "modules/gamepadManager",
    "json!data/loader_imgUI.json",
    "json!data/loader_imgAvatars.json",
    "json!data/loader_audioBGM.json",
    "json!data/loader_audioSFX.json",
    "global",
    "views/elem_footer",
    "views/screen",
    "views/screen_cardSelect",
    "views/screen_game",
    "views/screen_rulesSelect",
    "views/screen_title",
    "views/screen_userSettings",
    "views/screen_overlayAbout",
    "views/screen_overlayMenu",
    "jqueryNearest",
    "aggregation"
], function ($, _, AudioEngine, canvasWebGL, assetLoader, GamepadManager, loaderImgUI, loaderImgAvatars, loaderAudioBGM, loaderAudioSFX, _$, Elem_Footer) {
    var Screen_Title = require("views/screen_title");
    var loaders      = [loaderImgUI, loaderImgAvatars, loaderAudioBGM, loaderAudioSFX];

    _$.events.on("all", function (eventName, ...data) {
        /*if (data.length) {
            _$.debug.log("event triggered:", eventName, data);
        } else {
            _$.debug.log("event triggered:", eventName);
        }*/
    });

    _$.events.once("allLoadersComplete", function () {
        canvasWebGL.init();
        _$.ui.footer = new Elem_Footer();
        _$.ui.screen = new Screen_Title({ setup: true, fullIntro: true });

        $(window).on("beforeunload", function (e) {
            var confirmationMessage = "All unsaved progress will be lost. Do you really wish to leave?";
            (e || window.event).returnValue = confirmationMessage;     // Gecko and Trident
            return confirmationMessage;                                // Gecko and WebKit
        }).on("blur", function() {
            _$.audio.audioEngine.channels.master.fadeOut();
        }).on("focus", function() {
            _$.audio.audioEngine.channels.master.fadeIn({ to: 1 });
        });
    });

    _$.events.on("gamepadOn", function () {
        _$.controls.type = "gamepad";
    });

    _$.events.on("gamepadOff", function () {
        _$.controls.type = "mouse";
    });

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

    TweenMax.set(_$.dom, { opacity : 0 });
    setupScale();

    _$.controls.type           = "mouse";
    _$.controls.gamepadManager = new GamepadManager();
    _$.audio.audioEngine       = new AudioEngine();
    assetLoader.init(loaders);
});

(function () {
    function setupStats () {
        var stats = new window.Stats();
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

    setupStats();
})();
