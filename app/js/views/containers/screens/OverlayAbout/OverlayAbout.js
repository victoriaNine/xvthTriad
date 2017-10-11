import $ from 'jquery';
import { template } from 'lodash';
import { TimelineMax, Power3 } from 'gsap';

import _$ from 'store';
import Screen from 'Screens/Screen';
import Templ_OverlayAbout from './template.ejs';

export default Screen.extend({
  id       : "screen_overlayAbout",
  template : template(Templ_OverlayAbout),
  events   : {
    /* eslint-disable object-shorthand */
    "click .about_prevBtn" : "close",
    "click .about_social-element,.about_prevBtn,.about_credits" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .about_social-element,.about_prevBtn,.about_credits" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "click .about_social-fbBtn"  : function () {
      _$.utils.openSharePopup("facebook");
      _$.app.track("send", "event", {
        eventCategory: "socialShareEvent",
        eventAction: "aboutFacebook"
      });
    },
    "click .about_social-ttBtn"  : function () {
      _$.utils.openSharePopup("twitter");
      _$.app.track("send", "event", {
        eventCategory: "socialShareEvent",
        eventAction: "aboutTwitter"
      });
    },
    "click .about_social-rdtBtn" : function () {
      _$.utils.openSharePopup("reddit");
      _$.app.track("send", "event", {
        eventCategory: "socialShareEvent",
        eventAction: "aboutReddit"
      });
    },
    "click .about_social-tbrBtn" : function () {
      _$.utils.openSharePopup("tumblr");
      _$.app.track("send", "event", {
        eventCategory: "socialShareEvent",
        eventAction: "aboutTumblr"
      });
    },
    "click .about_credits" : function () {
      _$.app.track("send", "event", {
        eventCategory: "aboutEvent",
        eventAction: "clickCredits"
      });
    },
    "click .about_legal" : function () {
      _$.app.track("send", "event", {
        eventCategory: "aboutEvent",
        eventAction: "clickLegal"
      });
    },
    "click .about_info-volume" : function (e) {
      _$.utils.toggleMute(e.currentTarget);
    }
    /* eslint-enable */
  },

  initialize,
  transitionIn,
  transitionOut,
  close,
  toggleLine
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  this.$el.html(this.template({
    appVersion     : _$.app.version,
    appVersionFlag : _$.app.versionFlag,
    playersCount   : _$.utils.getFormattedNumber(_$.app.playersCount),
    playersLabel   : _$.app.playersCount === 1 ? "player" : "players"
  }));
  this.line = this.$(".about_line");
  this.logo = this.$(".about_logo");

  this.logo.append($(_$.assets.get("svg.ui.logo")));
  if (!_$.audio.audioEngine.channels.master.volume) {
    this.$(".about_info-volume").addClass("is--disabled");
  }

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => { this.logo.addClass("is--tweening"); });
  tl.from(this.$el, this.transitionSettings.slides, { opacity: 0, clearProps: "all" });
  tl.from(this.$(".about_bg"), this.transitionSettings.slides, { opacity: 0, scale: 1.25, clearProps: "all" }, `-=${this.transitionSettings.staggers * 2}`);
  tl.add(this.toggleLine("show"));
  tl.from(this.logo, this.transitionSettings.slides, { opacity: 0, scale: 1.25, clearProps: "all" }, `-=${this.transitionSettings.slides}`);
  tl.from($(".about_text, .about_credits, .about_legal"), this.transitionSettings.slides, { opacity: 0, y: -20, clearProps: "all" }, tl.recent().endTime());
  tl.from($(".about_info"), this.transitionSettings.slides, { opacity: 0, x: 20, clearProps: "all" }, tl.recent().startTime());
  tl.call(() => { _$.audio.audioEngine.playSFX("menuOpen"); }, [], null, tl.recent().endTime() - this.transitionSettings.slides);
  tl.staggerFrom($(".about_social-element"), this.transitionSettings.slides, { opacity: 0, y: 20, clearProps: "all" }, this.transitionSettings.staggers, `-=${this.transitionSettings.staggers * 2}`);
  tl.from(this.$(".about_prevBtn"), this.transitionSettings.slides, { opacity : 0, scale: 1.25, clearProps: "all" }, `-=${this.transitionSettings.staggers * 2}`);
  tl.call(() => {
    this.$el.addClass("is--showingLogo");
    this.logo.removeClass("is--tweening");
    _$.events.trigger("startUserEvents");
    _$.events.trigger("aboutPageOpen");
  });

  return this;
}

function transitionOut (nextScreen) {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => {
    this.logo.addClass("is--tweening");
    this.$el.removeClass("is--showingLogo");
  });
  tl.to(this.$(".about_prevBtn"), this.transitionSettings.slides, { opacity : 0, scale: 1.25 });
  tl.staggerTo($(".about_social-element"), this.transitionSettings.slides, { opacity: 0, y: 20 }, -0.1, `-=${this.transitionSettings.staggers * 2}`);
  tl.call(() => { _$.audio.audioEngine.playSFX("menuClose"); }, [], null, "-=0.1");
  tl.to($(".about_text, .about_credits, .about_legal"), this.transitionSettings.slides, { opacity: 0, y: -20 });
  tl.to($(".about_info"), this.transitionSettings.slides, { opacity: 0, x: 20 }, tl.recent().startTime());
  tl.to(this.logo, this.transitionSettings.slides, { opacity: 0, scale: 1.25 });
  tl.add(this.toggleLine("hide"), `-=${this.transitionSettings.slides}`);
  tl.to(this.$(".about_bg"), this.transitionSettings.slides, { opacity: 0, scale: 1.25 }, `-=${this.transitionSettings.slides}`);
  tl.to(this.$el, this.transitionSettings.slides, { opacity: 0 });
  tl.call(onTransitionComplete.bind(this));

  function onTransitionComplete () {
    _$.utils.addDomObserver(this.$el, () => {
      _$.events.trigger("startUserEvents");
      _$.events.trigger("aboutPageClosed");

      if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
        _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
      }
    }, true, "remove");
    this.remove();
  }

  return this;
}

function toggleLine (state) {
  const el = this.line;
  const tl = new TimelineMax();

  if (state === "show") {
    tl.set(el, { clearProps:"display" });
    tl.from(el, this.transitionSettings.longScroll, { opacity:0, width:0, ease: Power3.easeOut, clearProps:"all" });
  } else if (state === "hide") {
    tl.to(el, this.transitionSettings.longScroll, { width: 0, opacity: 0 });
    tl.set(el, { display:"none", clearProps:"width,opacity" }, `+=${this.transitionSettings.staggers}`);
  }

  return tl;
}

function close () {
  _$.ui.footer.toggleAboutPage();
}
