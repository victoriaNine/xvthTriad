import { map, isString, isFunction } from 'lodash';
import Backbone from 'backbone';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'utils';
import Comp_PromptOverlay from 'Components/PromptOverlay';
import Dropdown from 'Modules/Dropdown';

export default Backbone.View.extend({
  tagName   : "section",
  className : "screen",

  initialize,
  add,
  remove,
  updateControlsState,
  triggerGamepadAction,
  createDropdown,
  toggleSetting,
  disableSetting,
  error,
  info,
  choice,
  closePrompt,
  showSavePrompt,
  showAutoSavePrompt,
  toGame,
  waitForOpponent,
  changeScreen,
  checkBGMCrossfade,
  checkFooterUpdate,
  onLogout,
  fadeOut
});

function initialize (options = {}) { // eslint-disable-line no-unused-vars
  this.eventsDisabled     = false;
  this.promptOverlay      = new Comp_PromptOverlay();
  this.transitionSettings = _$.ui.transitionSettings;

  _$.events.on("startUserEvents", _delegate, this);
  _$.events.on("stopUserEvents", _undelegate, this);
  Backbone.View.prototype.initialize.call(this);
}

function add () {
  _$.utils.addDomObserver(this.$el, this.updateControlsState.bind(this), true);
  _$.dom.find("#screen").append(this.$el);
}

function remove () {
  _$.events.off("startUserEvents", _delegate, this);
  _$.events.off("stopUserEvents", _undelegate, this);
  if (_$.controls.type === "gamepad") {
    _$.events.off("gamepad", this.triggerGamepadAction, this);
  }
  Backbone.View.prototype.remove.call(this);
}

function updateControlsState () {
  const screenName = this.id.replace("screen_", "");

  if (screenName === "title") {
    if (_$.controls.gamepadManager && !_$.controls.gamepadManager.isGamepadActive(0)) {
      _$.controls.gamepadManager.activateGamepads(0);
    }
  }
}

function triggerGamepadAction (event, buttonValue, gamepad, originalEvent) {
  originalEvent    = originalEvent.replace("gamepad:", "");
  const buttonName =  originalEvent.split(":")[0];
  const eventType  = originalEvent.split(":")[1];
  let newTarget    = null;

  if (buttonName === "BUTTON_CROSS") {
    if (eventType === "press") {
      gamepad.cursor.press();
    } else if (eventType === "release") {
      gamepad.cursor.release();
    }
  }

  if (buttonName === "BUTTON_DOWN" || buttonName === "BUTTON_RIGHT" ||
  buttonName === "BUTTON_UP" || buttonName === "BUTTON_LEFT") {
    if (eventType === "release") {
      if (buttonName === "BUTTON_DOWN" || buttonName === "BUTTON_RIGHT") {
        newTarget = gamepad.cursor.getNextTarget();
      } else if (buttonName === "BUTTON_UP" || buttonName === "BUTTON_LEFT") {
        newTarget = gamepad.cursor.getPreviousTarget();
      }

      gamepad.cursor.moveToTarget(newTarget);
    }
  }
}

function _delegate () {
  this.delegateEvents();
  this.eventsDisabled = false;

  if (_$.controls.type === "gamepad") {
    _$.controls.gamepadManager.showCursors();
    _$.controls.gamepadManager.updateCursorTargets();
    _$.events.on("gamepad", this.triggerGamepadAction, this);
  }
}

function _undelegate () {
  if (_$.controls.type === "gamepad") {
    _$.controls.gamepadManager.hideCursors();
    _$.events.off("gamepad", this.triggerGamepadAction, this);
  }
  this.undelegateEvents();
  this.eventsDisabled = true;
}

function createDropdown (options = {}) {
  return new Dropdown({ screen: this, ...options });
}

function toggleSetting (selector, toggleSelector, state) {
  const dom = this.$(selector);

  if (state === "toggle") {
    state = dom.hasClass("is--on") ? false : true;
  }

  if (state) {
    dom.removeClass("is--off is--disabled").addClass("is--on");
    dom.find(toggleSelector).text("ON");
  } else {
    dom.removeClass("is--on is--disabled").addClass("is--off");
    dom.find(toggleSelector).text("OFF");
  }
}

function disableSetting (selector, toggleSelector) {
  const dom = this.$(selector);

  dom.removeClass("is--off is--on").addClass("is--disabled");
  dom.find(toggleSelector).text("- -");
}

function error (options) {
  _showPrompt.call(this, { ...options, type: "error" });
}

function info (options) {
  _showPrompt.call(this, { ...options, type: "info" });
}

function choice (options) {
  _showPrompt.call(this, { ...options, type: "choice" });
}

function closePrompt (callback) {
  this.promptOverlay.close(callback);
}

function _showPrompt (options) {
  if (_$.ui.screen.id === this.id) {
    if (!this.promptOverlay.isOpen) {
      _$.utils.addDomObserver(this.promptOverlay.$el, proceed.bind(this), true);
      this.$el.append(this.promptOverlay.$el);
    } else {
      proceed.call(this);
    }
  }

  function proceed () {
    this.promptOverlay.show(options);
  }
}

function showSavePrompt (e = {}) {
  if (_$.state.user.isInGame) {
    _$.audio.audioEngine.playSFX("menuOpen");
    this.info({
      titleBold    : "Currently",
      titleRegular : "in-game",
      msg          : "All unsaved progress will be lost",
      btnMsn       : "Cancel"
    });

    const confirmationMessage = "All unsaved progress will be lost. Do you really wish to leave?";
    (e || window.event).returnValue = confirmationMessage; // Gecko and Trident
    return confirmationMessage;                            // Gecko and WebKit
  }
}

function showAutoSavePrompt () {
  _$.audio.audioEngine.playSFX("gameGain");
  this.info({
    titleBold    : "Autosave",
    titleRegular : "complete",
    msg          : "Your progress was saved",
    autoClose    : true
  });
}

function toGame (userDeck) {
  if (_$.state.room) {
    // We send the user's selected deck to the opponent
    this.waitForOpponent(map(userDeck, "attributes"), proceed.bind(this));
  } else {
    proceed.call(this);
  }

  function proceed () {
    const gameInfo = {
      userDeck,
      rules    : _$.state.rules,
      room     : _$.state.room,
      opponent : _$.state.opponent
    };

    this.transitionOut("game", gameInfo);
    _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
    _$.audio.audioEngine.playSFX("titleStart");
  }
}

function waitForOpponent (userDeck, callback) {
  _$.comm.socketManager.emit("confirmReady", userDeck, onResponse.bind(this));

  _$.audio.audioEngine.playSFX("menuOpen");
  this.info({
    titleBold    : "Please",
    titleRegular : "wait",
    msg          : "Waiting for the other player to confirm...",
    btnMsg       : "Cancel",
    action       : onCancel.bind(this)
  });

  function onResponse (response) {
    _$.state.opponent = response.msg.opponent; // Update the final opponent info with the deck info received
    fetch(_$.state.opponent.avatar);           // Pre-load the opponent's avatar
    this.closePrompt();
    callback();
  }

  function onCancel () {
    _$.comm.socketManager.emit("cancelReady");
    this.closePrompt();
  }
}

function checkFooterUpdate (nextScreen) {
  const tl = new TimelineMax();

  if (_$.ui.screen.id === "screen_title") {
    if (!_$.ui.footer.isOpen) {
      tl.add(_$.ui.footer.toggleMenu("show"));
      tl.add(_$.ui.footer.toggleSocial("show"), 0.5);
      tl.call(() => { _$.ui.footer.isOpen = true; });
    }
  } else if (_$.ui.screen.id === "screen_game") {
    if (nextScreen === "title") {
      tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 });
      tl.add(_$.ui.footer.toggleLogo("hide"), 0.5);
      tl.call(() => { _$.ui.footer.isOpen = false; });
    } else if (nextScreen === "lounge") {
      tl.add(_$.ui.footer.toggleLogo("hide"));
      tl.add(_$.ui.footer.toggleMenu("show"), 0.5);
      tl.add(_$.ui.footer.toggleSocial("show"), 1);
      tl.call(() => { _$.ui.footer.isOpen = true; });
    }
  } else if (nextScreen === "title") {
    tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 });
    tl.add(_$.ui.footer.toggleSocial("hide"), 0.5);
    tl.add(_$.ui.footer.toggleMenu("hide"), 1);
    tl.call(() => { _$.ui.footer.isOpen = false; });
  } else if (nextScreen === "game") {
    tl.add(_$.ui.footer.toggleSocial("hide"));
    tl.add(_$.ui.footer.toggleMenu("hide"), 0.5);
    tl.add(_$.ui.footer.toggleLogo("show"), 1);
    tl.call(() => { _$.ui.footer.isOpen = false; });
  }

  return tl.timeScale(2);
}

function changeScreen (nextScreen, options = {}) {
  _$.app.track("set", {
    "dimension0" : "currentScreenId",
    "dimension1" : "fromMenu"
  });
  _$.app.track("send", "event", {
    eventCategory : "screenChange",
    eventAction   : nextScreen,
    dimension0    : _$.ui.screen.id.replace("screen_", ""),
    dimension1    : !!options.fromMenu
  });

  if (nextScreen === "title" || nextScreen === "userSettings" || nextScreen === "lounge" || options.fromMenu) {
    if (_$.state.room) {
      if (_$.state.user.isInLounge && nextScreen !== "lounge") {
        _$.comm.socketManager.emit("leaveLounge");
        _$.state.user.isInLounge = false;
      }

      _$.comm.socketManager.emit("playerReset");
    }

    _$.utils.addDomObserver(this.$el, () => {
      _$.events.trigger("startUserEvents");

      if (nextScreen === "title") {
        const Screen_Title = require("Screens/Title").default;
        _$.ui.screen     = new Screen_Title(options);
      } else if (nextScreen === "lounge") {
        const Screen_Lounge = require("Screens/Lounge").default;
        _$.ui.screen      = new Screen_Lounge(options);
      } else if (nextScreen === "roomSelect") {
        const Screen_RoomSelect = require("Screens/RoomSelect").default;
        _$.ui.screen          = new Screen_RoomSelect(options);
      } else if (nextScreen === "rulesSelect") {
        const Screen_RulesSelect = require("Screens/RulesSelect").default;
        _$.ui.screen           = new Screen_RulesSelect(options);
      } else if (nextScreen === "cardsSelect") {
        const Screen_CardSelect = require("Screens/CardSelect").default;
        _$.ui.screen          = new Screen_CardSelect(options);
      } else if (nextScreen === "cardAlbum") {
        const Screen_CardAlbum  = require("Screens/CardAlbum").default;
        _$.ui.screen          = new Screen_CardAlbum(options);
      } else if (nextScreen === "userSettings") {
        const Screen_UserSettings = require("Screens/UserSettings").default;
        _$.ui.screen            = new Screen_UserSettings(options);
      }
    }, true, "remove");
    this.remove();
  } else {
    // Game flow
    if (nextScreen === "game") { // eslint-disable-line no-lonely-if
      _$.utils.addDomObserver(this.$el, () => {
        _$.events.trigger("startUserEvents");

        const Screen_Game = require("Screens/Game").default;
        _$.ui.screen = new Screen_Game(options);
      }, true, "remove");
      this.remove();
    } else {
      _$.events.trigger("startUserEvents");
      if (nextScreen === "roomSelect") {
        const Screen_RoomSelect = require("Screens/RoomSelect").default;
        _$.ui.screen          = _$.ui.roomSelect ? _$.ui.roomSelect.transitionIn() : new Screen_RoomSelect(options);
      } else if (nextScreen === "rulesSelect") {
        const Screen_RulesSelect = require("Screens/RulesSelect").default;
        _$.ui.screen =_$.ui.rulesSelect ? _$.ui.rulesSelect.transitionIn() : new Screen_RulesSelect(options);
      } else if (nextScreen === "cardSelect") {
        const Screen_CardSelect = require("Screens/CardSelect").default;
        _$.ui.screen =_$.ui.cardSelect ? _$.ui.cardSelect.transitionIn() : new Screen_CardSelect(options);
      }
    }
  }
}

function checkBGMCrossfade (nextScreen) {
  if (_$.ui.screen.id === "screen_game") {
    _$.events.once("startUserEvents", () => {
      if (nextScreen === "title") {
        _$.audio.audioEngine.setBGM("bgm.menus");
      } else if (nextScreen === "lounge") {
        _$.audio.audioEngine.setBGM("bgm.lounge");
      }

      _$.audio.audioEngine.playBGM({ fadeDuration: 2 });
    });
  } else if (_$.ui.screen.id === "screen_lounge") {
    const bgmName = _$.state.room ? "bgm.loungeMenus" : "bgm.menus";

    _$.audio.audioEngine.crossfadeBGM({
      to          : bgmName,
      duration    : 2,
      onStart     : () => {
        _$.audio.audioEngine.channels.bgm.rampToVolume({ to: _$.state.user.get("bgmVolume"), delay: 1, duration: 1 });
        _$.audio.audioEngine.playBGM({ name: bgmName });
      },
      onComplete : () => {
        _$.audio.audioEngine.stopBGM();
        _$.audio.audioEngine.setBGM(bgmName);
      }
    });
  } else if (nextScreen === "lounge") {
    _$.audio.audioEngine.crossfadeBGM({
      to          : "bgm.lounge",
      duration    : 2,
      onStart     : () => {
        _$.audio.audioEngine.channels.bgm.rampToVolume({ to: 0.15, delay: 1, duration: 1 });
        _$.audio.audioEngine.playBGM({name: "bgm.lounge"});
      },
      onComplete : () => {
        _$.audio.audioEngine.stopBGM();
        _$.audio.audioEngine.setBGM("bgm.lounge");
      }
    });
  }
}

function onLogout (event, message) { // eslint-disable-line no-unused-vars
  if (_$.ui.screen.id === "screen_title") {
    _$.ui.screen.updateAccountLayout();
  }

  // Connection errors are already handled by the socket manager
  if (!isString(event) || event.match("disconnect|connect_timeout|kick")) {
    return;
  } else if (_$.state.user.get("userId")) {
    // If it's a valid event, we notify the socket manager the user should be logged out on the game server
    _$.comm.socketManager.emit("logout");
    _$.state.user.set("userId", null);
  }

  if (event.match("logout|userDeleted")) {
    doLogout.call(this);
  } else if (event.match("sessionExpired")) {
    _$.audio.audioEngine.playSFX("menuOpen");
    this.error({
      titleBold    : "Session",
      titleRegular : "expired",
      msg          : "You have been logged out",
      action       : this.closePrompt.bind(this, doLogout.bind(this))
    });
  } else {
    _$.audio.audioEngine.playSFX("menuOpen");
    this.error({
      msg    : event,
      btnMsg : "Close",
      action : this.closePrompt.bind(this, doLogout.bind(this))
    });
  }

  function doLogout () {
    this.fadeOut(this.changeScreen.bind(this, "title", { setup: true, fullIntro: true }));
  }
}

function fadeOut (callback) {
  _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
  TweenMax.to(_$.dom, 1, { opacity: 0,
    onComplete: () => {
      if (isFunction(callback)) {
        if (_$.audio.audioEngine.currentBGM.getState() === "ended") {
          callback();
        } else {
          _$.events.once(_$.audio.audioEngine.currentBGM.events.ended, callback);
        }
      }
    }
  });
}
