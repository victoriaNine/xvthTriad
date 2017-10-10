import $ from 'jquery';
import { template } from 'lodash';
import Backbone from 'backbone';
import { TweenMax } from 'gsap';

import _$ from 'store';
import Screen from './../Screen';
import Templ_Loading from './template.ejs';

export default Screen.extend({
    id       : "screen_loading",
    template : template(Templ_Loading),

    initialize
});

function initialize (options) {
    Screen.prototype.initialize.call(this);

    this.loadPercentage = 0;
    this.canvasAssets   = 0;
    this.$el.html(this.template());
    TweenMax.set([this.$(".loading_bg, .loading_wrapper"), _$.ui.canvas.dom], { opacity: 0 });

    _$.events.on("loadProgress", () => {
        if (_$.app.assetLoader.getPercentage() > this.loadPercentage) {
            this.loadPercentage = _$.app.assetLoader.getPercentage();
            TweenMax.set(this.$(".loading_line"), { width: this.loadPercentage + "%" });
        }
    });

    _$.events.on("fileLoaded:imgUI", (event) => {
        if (event.originEventName === "fileLoaded:imgUI:bg" ||
            event.originEventName === "fileLoaded:imgUI:bgDepthMap" ||
            event.originEventName === "fileLoaded:imgUI:bgPattern" ||
            event.originEventName === "fileLoaded:imgUI:bgFlare") {
            this.canvasAssets++;
            _checkCanvasAssets.call(this);
        }
    });

    _$.events.once("fileLoaded:imgUI:bg", () => {
        TweenMax.to(this.$(".loading_bg"), 1, { opacity: 1, clearProps: "opacity", delay: 1 });
    });

    _$.events.once("fileLoaded:imgUI:logoNoText", () => {
        this.$(".loading_logo").append($(_$.assets.get("svg.ui.logoNoText")));
        TweenMax.to(this.$(".loading_wrapper"), 1, { opacity: 1, clearProps: "opacity" });
    });

    _$.events.once("allLoadersComplete", () => {
        _$.events.off("loadProgress");
        $(".preloadFont").remove();

        _$.events.once("socketReady", (event, data) => {
            _$.comm.sessionManager.once("initialized", () => {
                proceed.call(this);
            });

            _$.app.playersCount = data.msg;
            _$.comm.sessionManager.configure();
        });

        _$.comm.socketManager.init();

        function proceed () {
            var tl = new TimelineMax();
            tl.call(() => { _$.events.trigger("launch"); }, [], null, this.transitionSettings.slides);
            tl.to(this.$el, this.transitionSettings.slides, { opacity: 0, scale: 1.25 }, `+=${this.transitionSettings.slides}`);
            tl.call(() => { this.remove(); });
        }
    });

    TweenMax.to(_$.dom, 2, { opacity : 1, clearProps: "opacity" });
    _preloadFonts();
    this.add();
}

function _checkCanvasAssets () {
    if (this.canvasAssets === 4) {
        _$.events.off("fileLoaded:imgUI");
        _$.ui.canvas.init();

        if (_$.app.env.deviceType === "mobile") {
            _$.state.FX_LEVEL = 2;
        }

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

    fonts.forEach((font) => {
        font.weights.forEach((weight) => {
            $("<div class='preloadFont'>").css({
                fontFamily: font.name,
                fontWeight: weight,
                opacity: 0
            }).text(font.name === "socicon" ? glyphs : "preLoad").appendTo($("body"));
        });
    });
}
