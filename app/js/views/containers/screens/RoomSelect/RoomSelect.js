import $ from 'jquery';
import { template, debounce } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_RoomSelect from './template.ejs';

export default Screen.extend({
  id       : "screen_roomSelect",
  template : template(Templ_RoomSelect),
  events   : {
    /* eslint-disable object-shorthand */
    "keyup .setting-roomName input"   : debounce(function (e) { this.validateInput(e.target); }, 250),
    "keydown .setting-roomName input" : function (e) {
      if (e.which === 13 && this.$(".roomSelect_content-screenNav-choice-nextBtn").is(":visible")) {
        e.preventDefault();
        this.$(".roomSelect_content-screenNav-choice-nextBtn").click();
      }
    },
    "click .roomSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("title"); },
    "click .roomSelect_content-screenNav-choice-nextBtn" : "toNextStep",
    "blur .setting-roomName input" : function () {
      this.showHelp();
    },
    "mouseenter .roomSelect_content-screenNav-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "click .roomSelect_content-screenNav-choice-element,.roomSelect_content-settings-setting" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "focus .setting-roomName input" : function () {
      _$.audio.audioEngine.playSFX("uiInput");
    }
    /* eslint-enable */
  },

  initialize,
  remove,

  toNextStep,
  transitionIn,
  transitionOut,
  showHelp,
  validateInput
});

function initialize (options) { // eslint-disable-line no-unused-vars
  // Disable lag smoothing for real time
  TweenMax.lagSmoothing(0);

  Screen.prototype.initialize.call(this);

  _$.ui.roomSelect  = this;
  this.settings     = null;
  this.modeDropdown = null;
  this.initialized  = false;

  this.$el.html(this.template());
  this.showHelp();

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function remove () {
  delete _$.ui.roomSelect;

  this.modeDropdown.remove();
  Screen.prototype.remove.call(this);

  if (_$.ui.rulesSelect) {
    _$.ui.rulesSelect.remove();
  }

  if (_$.ui.cardSelect) {
    _$.ui.cardSelect.remove();
  }

  // Re-enable lag smoothing
  TweenMax.lagSmoothing(1000, 16);
}

function toNextStep () {
  const settings   = {};
  const playerInfo = _$.state.user.getPlayerInfo();
  let modeSetting;

  settings.roomName = this.$(".setting-roomName input").val().trim();

  modeSetting       = this.modeDropdown.currentOption[0].className.replace("modeSetting-", "");
  settings.mode     = modeSetting;

  if (_$.ui.rulesSelect && this.settings &&
    this.settings.roomName === settings.roomName &&
    this.settings.mode && settings.mode
  ) {
    // If nothing has been changed, just go back to the rules selection screen
    proceed.call(this);
    return;
  }

  this.settings = settings;

  if (settings.mode === "create") {
    // Once both players have joined, the player creating the room can get their opponent's info
    _$.events.once("opponentJoined", (event, data) => {
      _$.state.opponent = data.msg.opponent;

      _$.audio.audioEngine.playSFX("gameGain");
      _$.ui.screen.info({
        titleBold    : "Opponent",
        titleRegular : "joined",
        msg          : _$.state.opponent.name + " has entered the room. The available rules have been updated.",
        autoClose    : true
      });

      if (_$.ui.rulesSelect) {
        _$.ui.rulesSelect.setAvailableRules(_$.state.opponent);
      }
    });

    _$.comm.socketManager.emit("createRoom", { settings, playerInfo }, onResponse.bind(this));
  } else if (settings.mode === "join") {
    _$.comm.socketManager.emit("joinRoom", { settings, playerInfo }, onResponse.bind(this));
  }

  function onResponse (response) {
    let msg;
    if (response.status === "ok") {
      if (settings.mode === "join") {
        // The player joining the room can already get their opponent's info
        _$.state.opponent = response.msg.opponent;

        _$.audio.audioEngine.playSFX("gameGain");
        _$.ui.screen.info({
          titleBold      : "Room",
          titleRegular   : "joined",
          msg            : "You have joined " + _$.state.opponent.name + "'s room.",
          autoClose      : true,
          action         : this.closePrompt.bind(this, proceed.bind(this))
        });
      } else {
        proceed.call(this);
      }
    } else if (response.status === "error") {
      _$.audio.audioEngine.playSFX("uiError");

      if (response.msg.reason === "reserved") {
        msg = "This room name is reserved.";
      } else if (response.msg.reason === "alreadyExists") {
        msg = "Room " + response.msg.roomName + " already exists. Please choose another name.";
      } else if (response.msg.reason === "doesntExists") {
        msg = "Room " + response.msg.roomName + " doesn't exist. You can create it.";
      } else if (response.msg.reason === "alreadyFull") {
        msg = "Room " + response.msg.roomName + " is already full.";
      } else if (response.msg.reason === "sameBrowser") {
        msg = "Please join room " + response.msg.roomName + " from a different browser " + response.msg.emitterName + " connected from.";
      }

      this.$(".setting-roomName input").addClass("is--invalid");
      this.$(".roomSelect_content-screenNav").css({ pointerEvents: "none" }).slideUp();
      this.showHelp(msg, true);
    }
  }

  function proceed () {
    _$.state.room = this.settings;
    this.transitionOut("rulesSelect", { readOnly: _$.state.room.mode === "join" });
  }
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  if (!this.initialized) {
    this.modeDropdown = this.createDropdown({
      selector         : ".setting-mode",
      dropdownSelector : ".roomSelect_content-settings-setting-select",
      onUpdate         : this.validateInput.bind(this, this.$(".setting-roomName input")[0])
    });
  }

  const tl = new TimelineMax();
  tl.set(this.$el, { clearProps: "display" });
  tl.set(this.$(".roomSelect_content-settings"), { clearProps: "opacity" });
  tl.set(this.$(".roomSelect_content-settings-setting"), { opacity: 0 });
  tl.call(() => {
    this.$(".roomSelect_header").slideDown(this.transitionSettings.slides * 1000);
  });
  tl.staggerTo(
    this.$(".roomSelect_content-settings-setting"),
    this.transitionSettings.slides,
    { opacity: 1, clearProps:"all" },
    this.transitionSettings.staggers,
    `+=${this.transitionSettings.slides}`
  );
  tl.call(() => {
    if (!this.initialized) {
      this.initialized = true;
    }

    _$.events.trigger("startUserEvents");
    this.$(".setting-roomName input").focus();
    this.validateInput(this.$(".setting-roomName input")[0]);
  }, null, [], `-=${this.transitionSettings.slides}`);

  return this;
}

function transitionOut (nextScreen, options) {
  _$.events.trigger("stopUserEvents");
  this.checkBGMCrossfade(nextScreen);

  const tl = new TimelineMax();
  tl.call(() => {
    this.$(".roomSelect_content-screenNav").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".roomSelect_content-settings"), this.transitionSettings.slides, { opacity: 0 }, tl.recent().endTime() + this.transitionSettings.slides);
  tl.call(() => {
    this.$(".roomSelect_header").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(() => {
    TweenMax.set(this.$el, { display: "none" });
    this.changeScreen(nextScreen, options);
  }, null, [], `+=${this.transitionSettings.slides}`);

  return this;
}

function validateInput (input) {
  const value = $(input).val().trim();
  let check;

  if (input === this.$(".setting-roomName input")[0]) {
    check = value.length && !value.match(/\W/g);
  }

  if (check) {
    if ($(input).hasClass("is--invalid")) {
      $(input).removeClass("is--invalid");
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!$(input).hasClass("is--invalid")) {
      $(input).addClass("is--invalid");
    }
  }

  if (this.$(".setting-roomName input").hasClass("is--invalid")) {
    if (this.$(".roomSelect_content-screenNav").is(":visible")) {
      this.$(".roomSelect_content-screenNav").css({ pointerEvents: "none" }).slideUp();
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!this.$(".roomSelect_content-screenNav").is(":visible")) {
      this.$(".roomSelect_content-screenNav").css({ pointerEvents: "" }).slideDown();
    }
  }
}

function showHelp (msgName, asIs) {
  const defaultMsg = "Give a name to the room you want to create, or enter the name of the room you want to join.";
  let text;

  if (!msgName) {
    text = defaultMsg;
  } else if (asIs) {
    text = msgName;
  } else {
    switch (msgName) {
      case "":
        text = "";
        break;
    }
  }

  this.$(".roomSelect_header-help").html(text);
}
