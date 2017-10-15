import $ from 'jquery';
import { template } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_Loading from './template.ejs';

export default Screen.extend({
  id       : "screen_loading",
  template : template(Templ_Loading),

  initialize
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  this.loadPercentage = 0;
  this.canvasAssets   = 0;
  this.$el.html(this.template());
  TweenMax.set([this.$(".loading_bg, .loading_wrapper")], { opacity: 0 });

  _$.events.on("loadProgress", () => {
    const percentage = _$.app.assetLoader.getPercentage();

    if (percentage > this.loadPercentage) {
      this.loadPercentage = percentage;
      this.$(".loading_line").css({ transform: `scaleX(${this.loadPercentage / 100})` });
    }
  });

  _$.events.on("fileLoaded:imgUI", (event) => {
    if (event.originEventName === "fileLoaded:imgUI:bg" ||
      event.originEventName === "fileLoaded:imgUI:bgDepthMap" ||
      event.originEventName === "fileLoaded:imgUI:bgPattern" ||
      event.originEventName === "fileLoaded:imgUI:bgFlare"
    ) {
      this.canvasAssets++;
      _checkCanvasAssets.call(this);
    }
  });

  _$.events.once("fileLoaded:imgUI:bg", () => {
    TweenMax.set(this.$(".loading_bg"), { opacity: 1, transition: "opacity 1s ease", clearProps: "opacity", delay: 1 });
  });

  _$.events.once("fileLoaded:imgUI:logoNoText", () => {
    this.$(".loading_logo").append($(_$.assets.get("svg.ui.logoNoText")));
    TweenMax.set(this.$(".loading_wrapper"), { opacity: 1, transition: "opacity 1s ease", clearProps: "opacity", delay: 0.5 });
  });

  _$.events.once("allLoadersComplete", () => {
    _$.events.off("loadProgress");

    _$.events.once("socketReady", (event, data) => {
      _$.comm.sessionManager.once("initialized", () => {
        proceed.call(this);
      });

      _$.app.playersCount = data.msg;
      _$.comm.sessionManager.configure();
    });

    _$.comm.socketManager.init();

    function proceed () {
      if (_$.app.env.deviceType !== "mobile") {
        _$.events.trigger("addFX");
      }

      const tl = new TimelineMax();
      tl.call(() => { _$.events.trigger("launch"); }, [], null, this.transitionSettings.slides);
      tl.set(this.$el, { opacity: 0, scale: 1.25, transition: `opacity ${this.transitionSettings.slides * 2}s, transform ${this.transitionSettings.slides * 2}s` }, `+=${this.transitionSettings.slides}`);
      tl.call(() => { this.remove(); }, [], null, `+=${this.transitionSettings.slides * 2}`);
    }
  });

  TweenMax.set(_$.dom, { opacity: 1, clearProps: "opacity" });
  _preloadFonts.call(this);
  this.add();

  _$.app.assetLoader.load(options.loaders);
}

function _checkCanvasAssets () {
  if (this.canvasAssets === 4) {
    _$.events.off("fileLoaded:imgUI");

    if (_$.app.env.deviceType !== "mobile") {
      _$.ui.canvas.init();
    }
  }
}

function _preloadFonts () {
  const glyphs = String.fromCharCode("0xf09a") + String.fromCharCode("0xf099") +
    String.fromCharCode("0xf281") + String.fromCharCode("0xf173") +
    String.fromCharCode("0xf028") + String.fromCharCode("0xf026");

  const fonts = [
    { name: "AvantGarde LT", weights: [200, 500, 700], text: 'preLoad' },
    { name: "FontAwesome", weights: ["normal"], text: glyphs }
  ];

  fonts.forEach((font) => {
    font.weights.forEach((weight) => {
      $("<div class='preloadFont'>").css({
        fontFamily: font.name,
        fontWeight: weight,
        opacity: 0
      }).text(font.text).appendTo(this.$el);
    });
  });
}
