define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_loading.html"
], function Screen_Loading ($, _, Backbone, _$, Screen, Templ_Loading) {
    return Screen.extend({
        id        : "screen_loading",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_Loading),

        initialize
    });

    function initialize (options) {
        this.loadPercentage = 0;
        this.canvasAssets   = 0;
        this.$el.html(this.template());
        TweenMax.set([this.$(".loading_bg, .loading_wrapper"), _$.ui.canvas.dom], { opacity: 0 });

        _$.events.on("loadProgress", () => {
            if (_$.app.assetLoader.getPercentage() > this.loadPercentage) {
                this.loadPercentage = _$.app.assetLoader.getPercentage();
                TweenMax.to(this.$(".loading_line"), 0.2, { width: this.loadPercentage + "%" });
            }
        });

        var that = this;
        _$.events.on("fileLoaded:imgUI", function (eventName, originalEventName) {
            if (originalEventName === "fileLoaded:imgUI:bg" ||
                originalEventName === "fileLoaded:imgUI:bgDepthMap" ||
                originalEventName === "fileLoaded:imgUI:bgPattern" ||
                originalEventName === "fileLoaded:imgUI:bgFlare") {
                that.canvasAssets++;
                _checkCanvasAssets.call(that);
            }
        });

        _$.events.once("fileLoaded:imgUI:bg", () => {
            TweenMax.to(this.$(".loading_bg"), 1, { opacity: 1, clearProps: "opacity", delay: 1 });
        });

        _$.events.once("fileLoaded:imgUI:logoNoText", () => {
            var logo = $(_$.assets.get("svg.ui.logoNoText"));
            this.$(".loading_logo").append(logo);

            TweenMax.to(this.$(".loading_wrapper"), 1, { opacity: 1, clearProps: "opacity" });
        });

        _$.events.once("allLoadersComplete", () => {
            _$.events.off("loadProgress");
            $(".preloadFont").remove();

            TweenMax.to(this.$el, 1, { opacity: 0, scale: "1.25", delay: 1,
                onStart    : () => {
                    _$.events.trigger("launch");
                },
                onComplete : () => {
                    this.remove();
                }
            });
        });

        TweenMax.to(_$.dom, 2, { opacity : 1, clearProps: "opacity" });
        _preloadFonts();
        this.add();
    }

    function _checkCanvasAssets () {
        if (this.canvasAssets === 4) {
            _$.events.off("fileLoaded:imgUI");
            _$.ui.canvas.init();
            _$.events.trigger("addFX");
            TweenMax.to(_$.ui.canvas.dom, 2, { opacity : 1, clearProps: "opacity", delay: 1 });
        }
    }

    function _preloadFonts () {
        var fonts = [
            { name: "AvantGarde LT", weights : [200, 500, 700] },
            { name: "socicon", weights : ["normal"] }
        ];

        var glyphs = String.fromCharCode("0xe041") + String.fromCharCode("0xe040") +
                     String.fromCharCode("0xe022") + String.fromCharCode("0xe059");

        _.each(fonts, (font) => {
            _.each(font.weights, (weight) => {
                $("<div class='preloadFont'>").css({
                    fontFamily: font.name,
                    fontWeight: weight,
                    opacity: 0
                }).text(font.name === "socicon" ? glyphs : "preLoad").appendTo($("body"));
            });
        });
    }
});
