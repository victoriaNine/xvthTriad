import { template, isFunction } from 'lodash';
import Backbone from 'backbone';
import { TimelineMax } from 'gsap';

import _$ from 'store';
import Templ_PromptOverlay from './template.ejs';

export default Backbone.View.extend({
  tagName   : "div",
  className : "prompt_overlay screen overlay",
  template  : template(Templ_PromptOverlay),
  events    : {
    /* eslint-disable object-shorthand */
    "click .prompt_overlay-confirmBtn"      : function () {
      this.confirmAction();
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "click .prompt_overlay-confirm2Btn"      : function () {
      this.confirmAction2();
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .prompt_overlay-confirmBtn,.prompt_overlay-confirm2Btn" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    }
    /* eslint-enable */
  },

  initialize,
  show,
  close,
  toTitleScreen,
  toLounge
});

function initialize (attributes) { // eslint-disable-line no-unused-vars
  this.$el.html(this.template());
  this.span           = this.$(".prompt_overlay-title").find("span");
  this.isOpen         = false;
  this.confirmAction  = null;
  this.confirmAction2 = null;
}

function show (options = { msg: "" }) {
  if (options.type === "error") {
    _$.app.track("set", "dimension0", "currentScreenId");
    _$.app.track("send", "event", {
      eventCategory : "errorEvent",
      eventAction   : options.msg,
      dimension0    : _$.ui.screen.id // Current screen ID
    });
  }

  if (this.$el.hasClass("is--active") && options.type !== "error" && !options.updatePrompt) {
    return;
  }

  switch (options.action) {
    case "close":
      options.action = this.close;
      break;
    case "title" :
      options.action = this.toTitleScreen;
      break;
    case "lounge" :
      options.action = this.toLounge;
      break;
    case "refresh" :
      options.action = window.location.reload.bind(window.location);
      break;
  }

  _$.events.trigger("stopUserEvents");
  this.undelegateEvents();

  const tl = new TimelineMax();
  if (this.$el.hasClass("is--active")) {
    tl.call(() => { this.$el.removeClass("is--active"); });
    tl.call(() => { this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").slideUp(400); }, [], null, "+=0.8");
  }

  tl.call(() => {
    if (options.type === "error") {
      options.titleBold    = options.titleBold || "An error";
      options.titleRegular = options.titleRegular || "occured";
      options.btnMsg       = options.btnMsg || ((_$.ui.screen.id === "screen_title") ? "Close" : "Return to title screen");
      this.confirmAction   = options.action || this.toTitleScreen;
    } else if (options.type === "info") {
      options.btnMsg     = options.btnMsg || "Close";
      this.confirmAction = options.action || this.close;
    } else if (options.type === "choice") {
      options.btnMsg      = options.btn1Msg;
      this.confirmAction  = options.action1;
      this.confirmAction2 = options.action2;

      this.$(".prompt_overlay-confirm2Btn").text(options.btn2Msg);
    }

    this.span.text(options.titleBold);
    options.titleRegular && this.$(".prompt_overlay-title").html(this.span).append(" " + options.titleRegular);
    this.$(".prompt_overlay-message").text(options.msg);
    this.$(".prompt_overlay-confirmBtn").text(options.btnMsg);
  });
  tl.call(() => { this.$el.addClass("is--active"); }, [], null, "+=0.1");
  if (options.type === "choice") {
    tl.call(() => { this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").slideDown(400); }, [], null, "+=0.8");
  } else if (!options.autoClose) {
    tl.call(() => { this.$(".prompt_overlay-confirmBtn").slideDown(400); }, [], null, "+=0.8");
  }
  tl.call(() => { _$.events.trigger("startUserEvents"); this.delegateEvents(); this.isOpen = true; });
  if (options.autoClose) {
    tl.call(() => { this.confirmAction(); }, [], null, "+=" + (options.autoCloseDelay || 1));
  }
}

function close (callback) {
  this.$el.removeClass("is--active");
  _$.utils.addDomObserver(this.$el, () => {
    this.isOpen         = false;
    this.confirmAction  = null;
    this.confirmAction2 = null;

    this.span.empty();
    this.$(".prompt_overlay-title").html(this.span);
    this.$(".prompt_overlay-message, .prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").empty();
    this.$(".prompt_overlay-confirmBtn, .prompt_overlay-confirm2Btn").hide();

    if (isFunction(callback)) {
      callback();
    }
  }, true, "remove");
  setTimeout(this.remove.bind(this), 800);
}

function toTitleScreen () {
  this.close(() => {
    if (_$.ui.menu) {
      this.toggleMainMenu("title");
    } else if (_$.ui.help) {
      this.toggleHelpPage("title");
    } else if (_$.ui.about) {
      this.toggleAboutPage("title");
    } else {
      // eslint-disable-next-line no-lonely-if
      if (_$.ui.screen.id !== "screen_title") {
        _$.ui.screen.transitionOut("title");
      }
    }
  });
}

function toLounge () {
  this.close(() => {
    _$.ui.screen.transitionOut("lounge");
  });
}
