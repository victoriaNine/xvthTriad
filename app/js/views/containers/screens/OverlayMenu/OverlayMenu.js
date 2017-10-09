import $ from 'jquery';
import { template } from 'lodash';
import Backbone from 'backbone';
import { TweenMax } from 'gsap';

import _$ from 'store';
import Screen from './../Screen';
import Templ_OverlayMenu from './template.ejs';

export default Screen.extend({
    id       : "screen_overlayMenu",
    template : template(Templ_OverlayMenu),
    events   : {
        "mouseenter .menu_element" : function (e) {
            TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.2, { y: -50 });
        },
        "mouseleave .menu_element" : function (e) {
            TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.2, { y: 0, clearProps: "all" });
        },
        "mouseenter .menu_element:not(.is--disabled)" : function (e) {
            _$.audio.audioEngine.playSFX("menuHover");
        },
        "click .menu_soloMode"     : "toSoloMode",
        "click .menu_versusMode"   : "toVersusMode",
        "click .menu_loungeRoom"   : "toLoungeRoom",
        "click .menu_cardAlbum"    : "toCardAlbum",
        "click .menu_userSettings" : "toUserSettings"
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

function initialize (options) {
    Screen.prototype.initialize.call(this);

    this.$el.html(this.template());
    TweenMax.set(this.$(".menu_element"), { pointerEvents: "none" });
    _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
    this.add();
}

function transitionIn () {
    _$.events.trigger("stopUserEvents");

    var tl = new TimelineMax();
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
    tl.call(() => {
        _$.events.trigger("startUserEvents");
        _$.events.trigger("mainMenuOpen");
        TweenMax.set(this.$(".menu_element"), { clearProps: "pointerEvents" });
    }, null, [], `-=${this.transitionSettings.slides}`);

    return this;
}

function transitionOut (nextScreen) {
    _$.events.trigger("stopUserEvents");

    var tl = new TimelineMax();
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
