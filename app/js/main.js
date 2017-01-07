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
        superlogin        : "libs/superlogin-client/superlogin",
        pouchdb           : "libs/pouchdb/dist/pouchdb-6.1.1",

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
        jsonPrune         : "libs/jsonPrune/json.prune",
        axios             : "libs/axios/dist/axios",
        eventemitter2     : "libs/eventemitter2/lib/eventemitter2",

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
    "superlogin",
    "pouchdb",
    "modules/audioEngine",
    "modules/canvasWebGL",
    "modules/assetLoader",
    "modules/gamepadManager",
    "modules/updateManager",
    "modules/socketManager",
    "json!data/loader_imgUI.json",
    "json!data/loader_imgAvatars.json",
    "json!data/loader_imgCards.json",
    "json!data/loader_imgHelp.json",
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
    "jqueryNearest",
    "jsonPrune"
], function (Modernizr, $, _, tweenMax, SocketIO, Stats, Superlogin, PouchDB, AudioEngine, CanvasWebGL, AssetLoader, GamepadManager, UpdateManager, SocketManager, loaderImgUI, loaderImgAvatars, loaderImgCards, loaderImgHelp, loaderAudioBGM, loaderAudioSFX, _$, Elem_Footer) {
    var Screen_Loading = require("views/screen_loading");
    var Screen_Title   = require("views/screen_title");
    var loaders        = [loaderAudioBGM, loaderAudioSFX, loaderImgUI, loaderImgAvatars, loaderImgCards, loaderImgHelp];

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

    // http://stackoverflow.com/a/11381730/989439
    function mobileCheck () {
        var check = false;
        (function (a) {
            if (/(android|ipad|playbook|silk|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) {
                check = true;
            }
        })(window.navigator.userAgent||window.navigator.vendor||window.opera);
        return check;
    }

    function phoneCheck () {
        var check = false;
        (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) {
                check = true;
            }
        })(window.navigator.userAgent||window.navigator.vendor||window.opera);
        return check;
    }

    function tabletCheck () {
        return mobileCheck() && !phoneCheck();
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
        window.history.replaceState({}, "", "/");
    }
    
    TweenMax.set(_$.dom, { opacity : 0 });
    setupScale();

    if (_$.debug.debugMode) {
        setupStats();
    }

    if (mobileCheck()) {
        $("html").addClass("isMobile");
        _$.app.env.deviceType = "mobile";
    }

    if (phoneCheck())  {
        $("html").addClass("isPhone");
        _$.app.env.mobileDeviceType = "mobile";
    }

    if (tabletCheck()) {
        $("html").addClass("isTablet");
        _$.app.env.mobileDeviceType = "tablet";
    }

    _$.events.on("all", function (eventName, ...data) {
        /*if (data.length) {
            _$.debug.log("event triggered:", eventName, data);
        } else {
            _$.debug.log("event triggered:", eventName);
        }*/
    });

    _$.events.once("launch", function () {
        _$.comm.sessionManager = new Superlogin(_$.app.sessionConfig);
        _$.comm.dbManager      = new PouchDB(_$.app.dbURL.concat("/users"));
        _$.comm.socketManager  = new SocketManager();
        _$.ui.footer           = new Elem_Footer();
        _$.ui.screen           = new Screen_Title({ setup: true, fullIntro: true });

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


(function () {

})();
