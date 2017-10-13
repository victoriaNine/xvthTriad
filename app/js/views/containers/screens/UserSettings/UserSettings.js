import $ from 'jquery';
import { template, debounce } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_UserSettings from './template.ejs';

export default Screen.extend({
  id       : "screen_userSettings",
  template : template(Templ_UserSettings),
  events   : {
    /* eslint-disable object-shorthand */
    "click .userSettings_content-save-choice-saveBtn"       : "saveGame",
    "click .userSettings_content-save-choice-cancelBtn"     : "resetChanges",
    "click .userSettings_content-save-choice-exportBtn"     : "exportSaveFile",
    "click .userSettings_content-save-choice-resetAlbumBtn" : function () {
      this.confirmAction = this.resetAlbum;
      this.toggleConfirm("show");
    },
    "click .userSettings_content-save-choice-deleteAccountBtn" : function () {
      this.confirmAction = this.deleteAccount;
      this.toggleConfirm("show");
    },
    "click .userSettings_content-save-choice-backBtn"    : function () { this.resetChanges(); this.transitionOut("title"); },
    "click .userSettings_content-load-choice-loadBtn"    : "loadGame",
    "click .userSettings_content-load-choice-cancelBtn"  : function () {
      this.$(".setting-import input").val("");
      this.toggleLoad("hide");
    },
    "click .userSettings_content-confirm-choice-confirmBtn" : function () { this.confirmAction(); },
    "click .userSettings_content-confirm-choice-cancelBtn"  : function () {this.toggleConfirm("hide"); },
    "keyup .setting-name input,.setting-email input,.setting-newPassword input,.setting-confirmPassword input" : debounce(function (e) { this.validateInput(e.target); }, 250),
    "change .setting-avatar input,.setting-import input"    : function (e) { this.validateInput(e.target); },
    "change .setting-bgm input,.setting-sfx input,.setting-notif"          : "updateVolume",
    "input .setting-bgm input,.setting-sfx input,.setting-notif"           : "updateVolume",
    "mouseenter .userSettings_content-save-choice-element,.userSettings_content-load-choice-element,.userSettings_content-confirm-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "click .userSettings_content-save-choice-element,.userSettings_content-load-choice-element,.userSettings_content-confirm-choice-element,.setting-difficulty,.setting-placingMode,.setting-notifyMode,.setting-inactiveAudio,.setting-country,.setting-avatar,.setting-import" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "focus .setting-name input,.setting-email input,.setting-newPassword input,.setting-confirmPassword input" : function () {
      _$.audio.audioEngine.playSFX("uiInput");
    },
    "click .setting-import .userSettings_content-settings-setting-label" : function () {
      this.$(".setting-import input").val("");
      this.toggleLoad("hide");
      this.validateInput(this.$(".setting-import input")[0]);
    },
    "click .setting-avatar .userSettings_content-settings-setting-label" : function () {
      this.$(".setting-avatar input").val("");
      this.validateInput(this.$(".setting-avatar input")[0]);
    }
    /* eslint-enable */
  },

  initialize,
  remove,

  toggleLoad,
  toggleConfirm,

  saveGame,
  resetChanges,
  loadGame,
  exportSaveFile,
  resetAlbum,
  deleteAccount,
  updateVolume,
  buildCountryList,

  transitionIn,
  transitionOut,
  validateInput
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  this.$el.html(this.template({
    isLoggedIn      : _$.comm.sessionManager.getSession(),
    userName        : _$.state.user.get("name"),
    email           : _$.state.user.get("email"),
    avatarSrc       : _$.state.user.get("avatar"),
    wonCount        : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").won),
    wonRankedCount  : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").wonRanked),
    lostCount       : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").lost),
    lostRankedCount : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").lostRanked),
    drawCount       : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").draw),
    drawRankedCount : _$.utils.getFormattedNumber(_$.state.user.get("gameStats").drawRanked),
    rankPoints      : _$.utils.getFormattedNumber(_$.state.user.get("rankPoints")),
    bgmVolume       : _$.state.user.get("bgmVolume") * 100,
    sfxVolume       : _$.state.user.get("sfxVolume") * 100,
    notifVolume     : _$.state.user.get("notifVolume") * 100
  }));

  this.difficultyDropdown    = null;
  this.placingModeDropdown   = null;
  this.notifyModeDropdown    = null;
  this.inactiveAudioDropdown = null;
  this.countryDropdown       = null;
  this.confirmAction         = null;

  if (_$.comm.sessionManager.getSession()) {
    this.countryTempl = this.$(".countrySetting-COUNTRY_CODE")[0].outerHTML;
    this.$(".countrySetting-COUNTRY_CODE").remove();
    this.buildCountryList();
  }

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function remove () {
  Screen.prototype.remove.call(this);
  this.difficultyDropdown.remove();
  this.placingModeDropdown.remove();
  this.inactiveAudioDropdown.remove();

  if (_$.comm.sessionManager.getSession()) {
    this.notifyModeDropdown.remove();
    this.countryDropdown.remove();
  }
}

function saveGame () {
  const settings = {};
  let difficultySetting;
  let placingModeSetting;
  let notifyModeSetting;
  let inactiveAudioSetting;
  let countrySetting;

  settings.name          = this.$(".setting-name input").val().trim();
  settings.avatar        = this.$(".setting-avatar input")[0].files[0];

  difficultySetting      = this.difficultyDropdown.currentOption[0].className.replace("difficultySetting-", "");
  settings.difficulty    = difficultySetting;
  placingModeSetting     = this.placingModeDropdown.currentOption[0].className.replace("placingModeSetting-", "");
  settings.placingMode   = placingModeSetting;
  inactiveAudioSetting   = this.inactiveAudioDropdown.currentOption[0].className.replace("inactiveAudioSetting-", "");
  settings.inactiveAudio = inactiveAudioSetting;

  settings.bgmVolume     = this.$(".setting-bgm input").val() / 100;
  settings.sfxVolume     = this.$(".setting-sfx input").val() / 100;

  if (_$.comm.sessionManager.getSession()) {
    settings.email       = this.$(".setting-email input").val().trim();
    notifyModeSetting    = this.notifyModeDropdown.currentOption[0].className.replace("notifyModeSetting-", "");
    settings.notifyMode  = notifyModeSetting;
    settings.notifVolume = this.$(".setting-notif input").val() / 100;
    countrySetting       = this.countryDropdown.currentOption[0].className.replace("countrySetting-", "");
    settings.country     = countrySetting === "unset" ? null : countrySetting;
  }

  this.$(".userSettings_header-help").text("");

  if (settings.avatar) {
    const url = URL.createObjectURL(settings.avatar);
    _$.utils.getBase64Image(url, (base64URL) => {
      _$.state.user.set({ avatar: base64URL });
      this.$(".userSettings_header-avatar-img").css("backgroundImage", "url(" + base64URL + ")");
      proceed.call(this);
    });
  } else {
    proceed.call(this);
  }

  function proceed () {
    let newSettings = {
      name          : settings.name,
      difficulty    : settings.difficulty,
      placingMode   : settings.placingMode,
      inactiveAudio : settings.inactiveAudio,
      bgmVolume     : settings.bgmVolume,
      sfxVolume     : settings.sfxVolume
    };

    if (_$.comm.sessionManager.getSession()) {
      newSettings = { ...newSettings, notifyMode: settings.notifyMode, country: settings.country };
    }

    _$.state.user.set(newSettings);

    _$.app.track("set", {
      "dimension0" : "difficulty",
      "dimension1" : "placingMode",
      "dimension2" : "notifyMode",
      "dimension3" : "inactiveAudio",
      "dimension4" : "country",
      "metric0"    : "albumSize",
      "metric1"    : "gameStats"
    });

    _$.app.track("send", "event", {
      eventCategory : "userSettingsEvent",
      eventAction   : "saveGame",
      dimension0    : _$.state.user.get("difficulty"),
      dimension1    : _$.state.user.get("placingMode"),
      dimension2    : _$.state.user.get("notifyMode"),
      dimension3    : _$.state.user.get("inactiveAudio"),
      dimension4    : _$.state.user.get("country"),
      metric0       : _$.state.user.get("album").length,
      metric1       : JSON.stringify(_$.state.user.get("gameStats"))
    });

    _$.events.on("userDataSaved", () => {
      _$.audio.audioEngine.playSFX("gameGain");
      this.$(".userSettings_header-help").text("Changes successfully saved!");

      if (_$.comm.sessionManager.getSession()) {
        _$.state.user.set("email", settings.email);
      }
    });

    if (_$.comm.sessionManager.getSession()) {
      const accountData = {
        currentPassword : this.$(".setting-currentPassword input").val().trim(),
        newPassword     : this.$(".setting-newPassword input").val().trim(),
        confirmPassword : this.$(".setting-confirmPassword input").val().trim(),
        newEmail        : settings.email
      };

      if (!accountData.newPassword) {
        delete accountData.password;
        delete accountData.newPassword;
        delete accountData.confirmPassword;

        this.$(".setting-currentPassword input, setting-confirmPassword input").val("");
      }

      if (accountData.newEmail === _$.state.user.get("email")) {
        delete accountData.newEmail;
      }

      _$.app.saveData(accountData, (error) => {
        this.$(".userSettings_header-help").text(error.message || error.error);
      });
    } else {
      _$.app.saveData();
    }
  }
}

function resetChanges () {
  this.$(".setting-name input").val(_$.state.user.get("name"));
  this.$(".setting-avatar input, .setting-import input").val("");
  this.$(".setting-bgm input").val(_$.state.user.get("bgmVolume") * 100).change();
  this.$(".setting-sfx input").val(_$.state.user.get("sfxVolume") * 100).change();
  this.difficultyDropdown.reset();
  this.placingModeDropdown.reset();
  this.inactiveAudioDropdown.reset();

  if (_$.comm.sessionManager.getSession()) {
    this.$(".setting-email input").val(_$.state.user.get("email"));
    this.$(".setting-notif input").val(_$.state.user.get("notifVolume") * 100).change();
    this.notifyModeDropdown.reset();
    this.countryDropdown.reset();
  }
}

function loadGame () {
  if (!_$.debug.debugMode) {
    _$.app.track("send", "event", {
      eventCategory : "userSettingsEvent",
      eventAction   : "loadGame"
    });
  }

  const file = this.$(".setting-import input")[0].files[0];
  _$.app.importSave(file, () => {
    this.fadeOut(this.transitionOut.bind(this, "title", { fullIntro: true }));
  });
}

function exportSaveFile () {
  _$.app.track("set", {
    "dimension0" : "difficulty",
    "metric0"    : "albumSize",
    "metric1"    : "gameStats"
  });
  _$.app.track("send", "event", {
    eventCategory : "userSettingsEvent",
    eventAction   : "exportSaveFile",
    dimension0    : _$.state.user.get("difficulty"),               // difficulty
    metric0       : _$.state.user.get("album").length,             // albumSize
    metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
  });

  _$.app.exportSave();
}

function resetAlbum () {
  _$.app.track("set", {
    "dimension0" : "difficulty",
    "metric0"    : "albumSize",
    "metric1"    : "gameStats"
  });
  _$.app.track("send", "event", {
    eventCategory : "userSettingsEvent",
    eventAction   : "resetAlbum",
    dimension0    : _$.state.user.get("difficulty"),               // difficulty
    metric0       : _$.state.user.get("album").length,             // albumSize
    metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
  });

  this.confirmAction = null;
  this.toggleConfirm("hide");
  _$.state.user.resetAlbum();

  _$.events.on("userDataSaved", () => {
    _$.audio.audioEngine.playSFX("gameGain");
    this.$(".userSettings_header-help").text("Card album reset.");
    _$.events.trigger("startUserEvents");
  });

  _$.events.trigger("stopUserEvents");
  _$.app.saveData();
}

function deleteAccount () {
  _$.app.track("set", {
    "dimension0" : "difficulty",
    "metric0"    : "albumSize",
    "metric1"    : "gameStats"
  });
  _$.app.track("send", "event", {
    eventCategory : "userSettingsEvent",
    eventAction   : "deleteAccount",
    dimension0    : _$.state.user.get("difficulty"),
    metric0       : _$.state.user.get("album").length,
    metric1       : JSON.stringify(_$.state.user.get("gameStats"))
  });

  this.confirmAction = null;
  this.toggleConfirm("hide");

  _$.events.once("initialized", () => {
    _$.audio.audioEngine.playSFX("gameGain");
    _$.ui.screen.info(null, {
      titleBold    : "Account",
      titleRegular : "deleted",
      msg          : "Thanks for playing The Fifteenth Triad!"
    });
  });

  setTimeout(() => {
    if (_$.comm.sessionManager.getSession()) {
      _$.comm.sessionManager.removeUser();
    } else {
      window.localStorage.removeItem(_$.app.name);
      this.fadeOut(this.transitionOut.bind(this, "title", { setup: true, fullIntro: true }));
    }
  }, 500);
}

function updateVolume (event) {
  const id    = event.target.id;
  const value = event.target.value;

  if (id === "bgmVolume") {
    _$.audio.audioEngine.channels.bgm.setVolume(value / 100);
  } else if (id === "sfxVolume") {
    _$.audio.audioEngine.channels.sfx.setVolume(value / 100);
    if (event.type === "input") {
      _$.audio.audioEngine.playSFX("cardFlip");
    }
  } else if (id === "notifVolume") {
    _$.audio.audioEngine.channels.notif.setVolume(value / 100);
    if (event.type === "input") {
      _$.audio.audioEngine.playNotif("loungeMsg");
    }
  }

  this.$("label[for=\"" + id + "\"]").html(value);
}

function buildCountryList () {
  const countryList = _$.utils.getCountryList();
  let dom;
  let className;
  let text;

  countryList.forEach((country) => {
    dom       = $(this.countryTempl).clone();
    className = dom[0].className.replace("COUNTRY_CODE", country.code);
    text      = dom.text().replace("COUNTRY_NAME", country.name);

    dom.removeClass().addClass(className).text(text);
    this.$(".setting-country .userSettings_content-settings-setting-select").append(dom);
  });
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");
  this.difficultyDropdown = this.createDropdown({
    selector              : ".setting-difficulty",
    dropdownSelector      : ".userSettings_content-settings-setting-select",
    defaultOptionSelector : ".difficultySetting-" + _$.state.user.get("difficulty"),
    onOpen                : onDropdownOpen.bind(this)
  });

  this.placingModeDropdown = this.createDropdown({
    selector              : ".setting-placingMode",
    dropdownSelector      : ".userSettings_content-settings-setting-select",
    defaultOptionSelector : ".placingModeSetting-" + _$.state.user.get("placingMode"),
    onOpen                : onDropdownOpen.bind(this)
  });

  this.inactiveAudioDropdown = this.createDropdown({
    selector              : ".setting-inactiveAudio",
    dropdownSelector      : ".userSettings_content-settings-setting-select",
    defaultOptionSelector : ".inactiveAudioSetting-" + _$.state.user.get("inactiveAudio"),
    onOpen                : onDropdownOpen.bind(this)
  });

  if (_$.comm.sessionManager.getSession()) {
    this.notifyModeDropdown = this.createDropdown({
      selector              : ".setting-notifyMode",
      dropdownSelector      : ".userSettings_content-settings-setting-select",
      defaultOptionSelector : ".notifyModeSetting-" + _$.state.user.get("notifyMode"),
      onOpen                : onDropdownOpen.bind(this),
      onUpdate              : () => {
        const inactiveAudioSetting = this.inactiveAudioDropdown.currentOption[0].className.replace("inactiveAudioSetting-", "");
        const notifyModeSetting    = this.notifyModeDropdown.currentOption[0].className.replace("notifyModeSetting-", "");
        if (notifyModeSetting === "onlyInactive" && inactiveAudioSetting === "muteAll") {
          this.inactiveAudioDropdown.scrollTo(".inactiveAudioSetting-onlyNotifs");
        }
      }
    });

    this.countryDropdown = this.createDropdown({
      selector              : ".setting-country",
      dropdownSelector      : ".userSettings_content-settings-setting-select",
      defaultOptionSelector : _$.state.user.get("country") ? ".countrySetting-" + _$.state.user.get("country") : ".countrySetting-unset",
      onOpen                : onDropdownOpen.bind(this)
    });
  }

  this.resetChanges();

  const tl = new TimelineMax();
  tl.set(this.$(".userSettings_content-settings"), { clearProps: "opacity" });
  tl.set(this.$(".userSettings_content-settings-setting, .userSettings_header-avatar"), { opacity: 0 });
  tl.call(() => {
    this.$(".userSettings_header").slideDown(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".userSettings_header-avatar"), this.transitionSettings.slides, { opacity: 1, clearProps:"all" }, `+=${this.transitionSettings.slides}`);
  tl.fromTo(this.$(".userSettings_content-settings-scroll"), this.transitionSettings.slides, { height: 0, opacity: 0 }, { height: "100%", opacity: 1, clearProps: "all" }, `-=${this.transitionSettings.slides}`);
  tl.staggerTo(
    this.$(".userSettings_content-settings-setting"),
    this.transitionSettings.slides,
    { opacity: 1, clearProps:"all" },
    this.transitionSettings.staggers,
    tl.recent().endTime() - this.transitionSettings.slides
  );
  tl.call(() => {
    this.$(".userSettings_content-save").slideDown(this.transitionSettings.slides * 1000);
    _$.events.trigger("startUserEvents");
  }, null, [], `-=${this.transitionSettings.slides}`);

  return this;

  function onDropdownOpen (dropdown) {
    const scrollValue = dropdown.dropdownDOM.offset().top + dropdown.dropdownDOM.height();
    TweenMax.to(this.$(".userSettings_content-settings-scroll")[0], 0.2, { scrollTop: scrollValue });
  }
}

function transitionOut (nextScreen, options) {
  _$.events.trigger("stopUserEvents");
  this.checkBGMCrossfade(nextScreen);

  const tl = new TimelineMax();
  tl.call(() => {
    this.$(".userSettings_content-save, .userSettings_content-load").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".userSettings_content-settings, .userSettings_header-avatar"), this.transitionSettings.slides, { opacity: 0 }, tl.recent().endTime() + this.transitionSettings.slides);
  tl.call(() => {
    this.$(".userSettings_header").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(() => {
    this.changeScreen(nextScreen, options);
  }, null, [], `+=${this.transitionSettings.slides}`);

  return this;
}

function toggleLoad (state) {
  if (state === "show") {
    this.$(".userSettings_content-load").css({pointerEvents: ""}).slideDown();
    this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
  } else if (state === "hide") {
    this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
    this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
  }
}

function toggleConfirm (state) {
  if (state === "show") {
    this.$(".userSettings_content-confirm").css({pointerEvents: ""}).slideDown();
    this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
  } else if (state === "hide") {
    this.$(".userSettings_content-confirm").css({pointerEvents: "none"}).slideUp();
    this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
  }
}

function validateInput (input) {
  const value = $(input).val().trim();
  let check;

  if (input === this.$(".setting-name input")[0]) {
    check = value.length;
  } else if (input === this.$(".setting-email input")[0]) {
    check = value.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/);
  } else if (input === this.$(".setting-newPassword input")[0]) {
    check = !value.length || value.length >= 6;
  }  else if (input === this.$(".setting-confirmPassword input")[0]) {
    check = value === this.$(".setting-newPassword input").val().trim();
  }  else if (input === this.$(".setting-avatar input")[0]) {
    check = !input.files.length || !!input.files[0].name.match(/\.jpg|\.jpeg|\.png|\.gif$/);
  } else if (input === this.$(".setting-import input")[0]) {
    check = !input.files.length || input.files[0].name.endsWith("." + _$.app.saveExt);
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

  if (this.$(".userSettings_content-settings-setting-input").hasClass("is--invalid")) {
    if (this.$(".userSettings_content-save").is(":visible")) {
      this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
    }

    if (this.$(".userSettings_content-load").is(":visible")) {
      this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (input === $(".setting-import input")[0]) {
      if (!input.files.length && this.$(".userSettings_content-load").is(":visible")) {
        this.toggleLoad("hide");
      } else if (input.files.length && !this.$(".userSettings_content-load").is(":visible")) {
        this.toggleLoad("show");
      }
    } else if (!this.$(".userSettings_content-save, .userSettings_content-load, .userSettings_content-confirm").is(":visible")) {
      this.$(".userSettings_content-save").css({ pointerEvents: "" }).slideDown();
    }
  }
}
