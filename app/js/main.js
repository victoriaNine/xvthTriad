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

        global            : "global"
    },

    shim: {
        jqueryNearest : ["jquery"]
    }
});

require([
    "jquery",
    "underscore",
    "modules/canvasWebGL",
    "modules/assetLoader",
    "json!data/loader_img.json",
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
    "jqueryNearest"
], function ($, _, canvasWebGL, assetLoader, loaderImg, _$, Elem_Footer) {
    var Screen_Title = require("views/screen_title");
    var loaders      = [loaderImg];

    _$.events.on("all", function (eventName) {
        console.log("event triggered:", eventName);
    });

    _$.events.once("allLoadersComplete", function () {
        canvasWebGL.init();
        _$.ui.footer = new Elem_Footer();
        _$.ui.screen = new Screen_Title({ setup: true, fullIntro: true });

        $(window).on("beforeunload", function (e) {
            var confirmationMessage = "All unsaved progress will be lost. Do you really wish to leave?";
            (e || window.event).returnValue = confirmationMessage;     // Gecko and Trident
            return confirmationMessage;                                // Gecko and WebKit
        });
    });

    TweenMax.set(_$.dom, { opacity : 0 });
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

    function pixelRatioAdjust () {
        var html             = document.querySelector("html");
        var body             = document.body;
        var devicePixelRatio = window.devicePixelRatio = window.devicePixelRatio || 1;

        window.screen       = window.screen || {};
        screen.actualWidth  = window.screen.width * devicePixelRatio;
        screen.actualHeight = window.screen.height * devicePixelRatio;

        var scalar           = 1 / devicePixelRatio;
        var offset           = (devicePixelRatio * 100 - 100) / 2;
        html.style.width     = "calc(100vw * " + devicePixelRatio + ")";
        html.style.height    = "calc(100vh * " + devicePixelRatio + ")";
        body.style.transform = "scale(" + scalar + ") translate(-" + offset + "%, -" + offset + "%)";
    }

    setupStats();
    pixelRatioAdjust();
})();
