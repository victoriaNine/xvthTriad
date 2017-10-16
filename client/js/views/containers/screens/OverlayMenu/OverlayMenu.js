import $ from 'jquery';
import { template } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_OverlayMenu from './template.ejs';

export default Screen.extend({
  id       : "screen_overlayMenu",
  template : template(Templ_OverlayMenu),
  events   : {
    /* eslint-disable object-shorthand */
    "mouseenter .menu_element" : function (e) {
      TweenMax.set($(e.currentTarget).find(".menu_element-bg"), { y: -50 });
    },
    "mouseleave .menu_element" : function (e) {
      TweenMax.set($(e.currentTarget).find(".menu_element-bg"), { clearProps: "transform" });
    },
    "mouseenter .menu_element:not(.is--disabled)" : function () {
      _$.audio.audioEngine.playSFX("menuHover");
    },
    "click .menu_soloMode"     : "toSoloMode",
    "click .menu_versusMode"   : "toVersusMode",
    "click .menu_loungeRoom"   : "toLoungeRoom",
    "click .menu_cardAlbum"    : "toCardAlbum",
    "click .menu_userSettings" : "toUserSettings"
    /* eslint-enable */
  },

  initialize,
  transitionIn,
  transitionOut,
  toSoloMode,
  toVersusMode,
  toLoungeRoom,
  toCardAlbum,
  toUserSettings
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  this.$el.html(this.template());
  TweenMax.set(this.$(".menu_element"), { pointerEvents: "none" });
  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.staggerFrom(
    this.$(".menu_element"),
    this.transitionSettings.slides,
    { opacity: 0, clearProps: "opacity" },
    this.transitionSettings.staggers
  );
  tl.staggerFrom(
    this.$(".menu_element-bg"),
    this.transitionSettings.slides,
    { opacity: 0, y: 50, clearProps: "all" },
    this.transitionSettings.staggers,
    this.transitionSettings.slides * 2
  );
  tl.to(
    this.$(".menu_wrapper"),
    this.transitionSettings.slides,
    { backgroundColor: "rgba(0, 0, 0, 1)" },
    `-=${this.transitionSettings.slides * 3}`
  );
  tl.call(() => {
    _$.events.trigger("startUserEvents");
    _$.events.trigger("mainMenuOpen");
    TweenMax.set(this.$(".menu_element"), { clearProps: "pointerEvents" });
  }, null, [], `-=${this.transitionSettings.slides}`);

  return this;
}

function transitionOut (nextScreen) {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.set(this.$(".menu_element"), { pointerEvents: "none" });
  tl.staggerTo(
    this.$(".menu_element-bg"),
    this.transitionSettings.slides,
    { opacity: 0, y: 50 },
    -1 * this.transitionSettings.staggers
  );
  tl.staggerTo(
    this.$(".menu_element"),
    this.transitionSettings.slides,
    { opacity: 0 },
    -1 * this.transitionSettings.staggers,
    this.transitionSettings.slides * 2
  );
  tl.to(
    this.$(".menu_wrapper"),
    this.transitionSettings.slides,
    { backgroundColor: "rgba(0, 0, 0, 0)" },
    `-=${this.transitionSettings.slides * 2}`
  );
  tl.call(onTransitionComplete.bind(this));

  function onTransitionComplete () {
    _$.utils.addDomObserver(this.$el, () => {
      _$.events.trigger("startUserEvents");
      _$.events.trigger("mainMenuClosed");

      if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
        _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
      }
    }, true, "remove");
    this.remove();
  }

  return this;
}

function toSoloMode     () { _$.ui.footer.toggleMainMenu("rulesSelect"); }
function toVersusMode   () { _$.ui.footer.toggleMainMenu("roomSelect"); }
function toLoungeRoom   () { _$.ui.footer.toggleMainMenu("lounge"); }
function toCardAlbum    () { _$.ui.footer.toggleMainMenu("cardAlbum"); }
function toUserSettings () { _$.ui.footer.toggleMainMenu("userSettings"); }
