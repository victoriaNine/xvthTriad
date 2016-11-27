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

        jqueryNearest     : "libs/jquery-nearest/src/jquery.nearest",

        global            : "global"
    },

    shim: {
        jqueryNearest  : ["jquery"]
    }
});

require([
    "jquery",
    "underscore",
    "modules/canvasWebGL",
    "modules/assetLoader",
    "views/screen_title",
    "views/elem_footer",
    "json!data/loader_img.json",
    "global",
    "jqueryNearest"
], function ($, _, canvasWebGL, assetLoader, Screen_Title, Elem_Footer, loaderImg, _$) {
    var events  = _$.events;
    var loaders = [loaderImg];

    events.on("all", function (eventName) {
        console.log("event triggered:", eventName);
    });

    events.on("allLoadersComplete", function () {
        canvasWebGL.init();
        _$.state.footer = new Elem_Footer();
        _$.state.screen = new Screen_Title({ firstInit: true });
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
