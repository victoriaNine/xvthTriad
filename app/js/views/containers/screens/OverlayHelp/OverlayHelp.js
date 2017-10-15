import $ from 'jquery';
import { template } from 'lodash';
import { TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_OverlayHelp from './template.ejs';
import Templ_HelpBasicRules from './template_helpBasicRules.ejs';
import Templ_HelpAdvancedRules from './template_helpAdvancedRules.ejs';
import Templ_HelpStartSolo from './template_helpStartSolo.ejs';
import Templ_HelpStartVersus from './template_helpStartVersus.ejs';
import Templ_HelpChallengerPlayer from './template_helpChallengePlayer.ejs';
import Templ_HelpRankings from './template_helpRankings.ejs';

const HELP_TOPICS = "basicRules|advancedRules|startSolo|startVersus|challengePlayer|rankings";

export default Screen.extend({
  id       : "screen_overlayHelp",
  template : template(Templ_OverlayHelp),
  events   : {
    /* eslint-disable object-shorthand */
    "click .help_content-screenNav-choice-backBtn" : "showTopics",
    "click .help_content-topics-topic[class*=topic-]" : function (e) {
      this.showGuide(e.currentTarget.className.match(HELP_TOPICS)[0]);
    },
    "mouseenter .help_content-topics-topic[class*=topic-]" : function (e) {
      this.showHelp(e.currentTarget.className.match(HELP_TOPICS)[0]);
    },
    "mouseleave .help_content-topics-topic" : function () {
      this.showHelp();
    },
    "click .help_content-topics-topic[class*=topic-],.help_content-screenNav-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .help_content-topics-topic[class*=topic-],.help_content-screenNav-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    }
    /* eslint-enable */
  },

  initialize,
  transitionIn,
  transitionOut,
  close,
  showGuide,
  showTopics,
  showHelp
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  this.$el.html(this.template());
  this.currentGuide   = null;
  this.guideTemplates = {
    basicRules      : Templ_HelpBasicRules,
    advancedRules   : Templ_HelpAdvancedRules,
    startSolo       : Templ_HelpStartSolo,
    startVersus     : Templ_HelpStartVersus,
    challengePlayer : Templ_HelpChallengerPlayer,
    rankings        : Templ_HelpRankings
  };

  this.showHelp();

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.to(_$.ui.screen.$el, this.transitionSettings.slides, { opacity: 0 });
  tl.from(this.$el, this.transitionSettings.slides, { opacity: 0, clearProps: "all" });
  tl.call(() => {
    this.$(".help_header").slideDown(this.transitionSettings.slides * 1000);
  });
  tl.staggerFrom(
    this.$(".help_content-topics-topic"),
    this.transitionSettings.slides,
    { opacity: 0, clearProps:"all" },
    this.transitionSettings.staggers,
    `+=${this.transitionSettings.slides}`
  );
  tl.call(() => {
    _$.events.trigger("startUserEvents");
    _$.events.trigger("helpPageOpen");
  });

  return this;
}

function transitionOut (nextScreen) {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => {
    this.$(".help_content-screenNav").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".help_content-topics, .help_content-guide"), this.transitionSettings.slides, { opacity: 0 }, `+=${this.transitionSettings.slides}`);
  tl.call(() => {
    this.$(".help_header").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$el, this.transitionSettings.slides, { opacity: 0 });
  tl.to(_$.ui.screen.$el, this.transitionSettings.slides, { opacity: 1, clearProps: "opacity" });
  tl.call(onTransitionComplete.bind(this));

  function onTransitionComplete () {
    _$.utils.addDomObserver(this.$el, () => {
      _$.events.trigger("startUserEvents");
      _$.events.trigger("helpPageClosed");

      if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
        _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
      }
    }, true, "remove");
    this.remove();
  }

  return this;
}

function close () {
  _$.ui.footer.toggleHelpPage();
}

function showGuide (topicName) {
  _$.app.track("send", "event", {
    eventCategory: "helpEvent",
    eventAction: topicName
  });

  _$.events.trigger("stopUserEvents");

  const title         = this.$(".topic-" + topicName).text();
  const guide         = $("<div>").addClass("help_" + topicName);
  const guideTemplate = template(this.guideTemplates[topicName]);
  guide.html(guideTemplate());

  let img;
  $(guide).find("figure").each((index, figure) => {
    img = require(`Assets/img/help/${topicName + (index + 1)}.png`);

    if (img) {
      $(figure).prepend(img);
    }
  });

  const tl = new TimelineMax();
  tl.to(this.$(".help_content-topics"), this.transitionSettings.slides, { opacity: 0 });
  tl.set(this.$(".help_content-topics"), { display: "none", clearProps: "opacity" });
  tl.set(this.$(".help_content-guide"), { clearProps: "display" });
  tl.to(this.$(".help_header-title, .help_header-help, hr"), this.transitionSettings.slides, { opacity: 0 });
  tl.call(() => {
    this.$(".help_content-guide-scroll").html(guide);
    this.$(".help_header-title-topicName").text(" / " + title);
    this.showHelp(topicName);
  });
  tl.to(this.$(".help_header-title, .help_header-help, hr"), this.transitionSettings.slides, { opacity: 1, clearProps: "opacity" });
  tl.fromTo(this.$(".help_content-guide-scroll"), this.transitionSettings.slides, { height: 0, opacity: 0 }, { height: "100%", opacity: 1, clearProps: "all" });
  tl.call(() => {
    this.$(".help_content-screenNav").slideDown(this.transitionSettings.slides * 1000);
    _$.events.trigger("startUserEvents");
    this.currentGuide = topicName;
  });
}

function showTopics () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => { this.$(".help_content-screenNav").slideUp(this.transitionSettings.slides * 1000); });
  tl.to(this.$(".help_content-guide"), this.transitionSettings.slides, { opacity: 0 }, `+=${this.transitionSettings.slides}`);
  tl.set(this.$(".help_content-guide"), { display: "none", clearProps: "opacity" });
  tl.set(this.$(".help_content-topics"), { clearProps: "display" });
  tl.to(this.$(".help_header-title, .help_header-help, hr"), this.transitionSettings.slides, { opacity: 0 });
  tl.call(() => {
    this.$(".help_content-guide-scroll, .help_header-title-topicName").empty();
    this.showHelp();
  });
  tl.to(this.$(".help_header-title, .help_header-help, hr"), this.transitionSettings.slides, { opacity: 1, clearProps: "opacity" });
  tl.staggerFrom(this.$(".help_content-topics-topic"), this.transitionSettings.slides, { opacity: 0, clearProps:"all" }, this.transitionSettings.staggers);
  tl.call(() => {
    _$.events.trigger("startUserEvents");
  });
}

function showHelp (msgName, asIs) {
  const defaultMsg = "Select a topic to get information on it.";
  let text;

  if (!msgName) {
    text = defaultMsg;
  } else if (asIs) {
    text = msgName;
  } else {
    switch (msgName) {
      case "basicRules":
        text = "Learn the basic rules of the Fifteenth Triad.";
        break;
      case "advancedRules":
        text = "Learn the advanced and special rules of the Fifteenth Triad.";
        break;
      case "startSolo":
        text = "How to start a game in Solo mode (play against the computer).";
        break;
      case "startVersus":
        text = "How to start a game in Versus mode (play against a friend).";
        break;
      case "challengePlayer":
        text = "How to challenge another player in the Lounge Room.";
        break;
      case "rankings":
        text = "Learn about the ranking system.";
        break;
    }
  }

  this.$(".help_header-help").html(text);
}
