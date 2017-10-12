import $ from 'jquery';
import { clone, get, set, isNil, map, isFunction, isArray, each, isString, random, filter, find, isDate, omit } from 'lodash';
import Backbone from 'backbone';
import Elo from 'arpad';
import { TimelineMax } from 'gsap';

import cardList from './data/cardList.json';
import countryList from './data/countryList.json';

class AssetManager {
  constructor () {
    this.img = {
      ui      : {},
      cards   : {},
      avatars : {}
    };

    this.audio = {
      bgm : {},
      sfx : {}
    };
  }

  set (path, value) { return set(this, path, value); }
  get (path, defaultValue, noClone) {
    const asset = get(this, path);

    if (!asset) {
      _$.debug.warn("Missing asset:", path);

      if (defaultValue) {
        return this.get(path, defaultValue, noClone);
      }

      return null;
    }

    return noClone ? asset : asset.cloneNode(true);
  }
}

const startTime = Date.now();
const app       = Object.create(null, {
  name          : { value: `${__APP_NAME__}` },
  version       : { value: `${__VERSION__}` },
  versionName   : { value: `${__VERSION_NAME__}` },
  versionFlag   : { value: `${__VERSION_FLAG__}` },
  currentTime   : { get: getCurrentTime },
  checkUpdates  : { value: checkUpdates },
  saveData      : { value: saveData },
  loadData      : { value: loadData },
  checkDataType : { value: getSaveDataType },
  importSave    : { value: importSave },
  exportSave    : { value: exportSave },
  encodeData    : { value: getEncodedData },
  decodeData    : { value: getDecodedData },
  track         : { value: sendGAevent },
  env           : { value: {
    deviceType       : "browser",
    mobileDeviceType : null
  }},
  sessionConfig: { value : {
    noDefaultEndpoint  : false,
    providers          : ["local"],
    refreshThreshold   : 0.9
  }},
  saveConfig: { value: {
    savePrefix    :`${__APP_NAME__}:save/`,
    sessionPrefix :`${__APP_NAME__}:session/`,
    extension     : "xvtsave"
  }}
});
const dom       = $("#app");
const assets    = new AssetManager();
const events    = clone(Backbone.Events);
const state     = { DECK_SIZE: 5 };
const ui        = {
  transitionSettings: {
    slides: 0.3,
    staggers: 0.1,
    longScroll: 0.7,
  }
};
const controls  = {};
const audio     = {};
const comm      = {};
const utils = {
  getAppSizeRatio,
  getDragSpeed,
  getCardList,
  getCountryList,
  getRandomName,
  getRandomCards,
  getAbsoluteOffset,
  getDestinationCoord,
  getPositionFromCaseName,
  getCaseNameFromPosition,
  getFormattedNumber,
  getFormattedDate,
  getElo,
  getUID,
  getUserData,
  addDomObserver,

  fadeIn,
  fadeOut,
  getTopElementAt,
  isVisibleByUser,
  getNodeIndex,
  getLocalStorage,

  getBase64Image,
  timecodeToSecs,
  toggleMute,
  openSharePopup
};

const debug = {
  debugMode: __IS_DEV__,
  log,
  warn,
  error
};

const shareSettings = {
  url      : $("meta[property='og:url']")[0].content,
  text     : $("meta[name='twitter:description']")[0].content,
  posttype : "link",
  hashtags : "ff,ff15,ffxv,tripletriad",
  tags     : $("meta[name='keywords']")[0].content,
  title    : $("meta[property='og:title']")[0].content,
  content  : $("meta[property='og:url']")[0].content,
  caption  : $("meta[property='og:description']")[0].content,
  showVia  : ""
};

const _$ = {
  app,
  dom,
  ui,
  audio,
  state,
  assets,
  events,
  utils,
  debug,
  controls,
  comm
};

$(window).resize(() => {
  if (isNil(window.resizeTiemout)) {
    _$.events.trigger("resizeStart");
  }

  clearTimeout(window.resizeTiemout);
  window.resizeTiemout = setTimeout(() => {
    window.resizeTiemout = null;
    _$.events.trigger("resize");
  }, 500);
});

if (_$.debug.debugMode) {
  window._$ = _$;
}

export default _$;

/* TIME */
function getCurrentTime () {
  return parseInt((_$.audio.audioEngine && _$.audio.audioEngine.audioCtx) ?
    _$.audio.audioEngine.audioCtx.currentTime * 1000 : Date.now() - startTime, 10);
}

/* SOCIAL SHARE*/
function openSharePopup (platform) {
  window.open(_getShareUrl({ ...shareSettings, platform }), "", "toolbar=0,status=0,width=540,height=600");
}

function _getShareUrl (options = {}) {
  switch (options.platform) {
    case "facebook":
      return "https://www.facebook.com/sharer.php?u=" + encodeURIComponent(options.url);
    case "twitter":
      return "https://twitter.com/intent/tweet?url=" + encodeURIComponent(options.url) +
      "&text="     + encodeURIComponent(options.text) +
      "&hashtags=" + encodeURIComponent(options.hashtags);
    case "reddit":
      return "https://www.reddit.com/submit?url=" + encodeURIComponent(options.url);
    case "tumblr":
      return "http://tumblr.com/widgets/share/tool?canonicalUrl=" + encodeURIComponent(options.url) +
      "&posttype=" + encodeURIComponent(options.posttype) +
      "&tags="     + encodeURIComponent(options.tags) +
      "&title="    + encodeURIComponent(options.title) +
      "&content="  + encodeURIComponent(options.content) +
      "&caption="  + encodeURIComponent(options.caption) +
      "&show-via=" + encodeURIComponent(options.showVia);
  }
}

/* TRACKING */
function sendGAevent (...args) {
  if (!_$.debug.debugMode) {
    window.ga(...args);
  }
}

/* LOGGING */
function log ()   { _makeLog("log", arguments); }
function warn ()  { _makeLog("warn", arguments); }
function error () { _makeLog("error", arguments); }

function _makeLog (type, message) {
  const log = [_$.app.currentTime.toString()].concat(Array.prototype.slice.call(message));
  if (_$.debug.debugMode) {
    console[type].apply(null, log);
  }
}

/* AUDIO */
function timecodeToSecs (timeCode) {
  const timeValues = map(timeCode.split(":"), parseFloat);
  return timeValues[0] * 60 * 60 + timeValues[1] * 60 + timeValues[2];
}

function toggleMute (iconDOM) {
  if (_$.audio.audioEngine.channels.master.isMuted) {
    _$.audio.audioEngine.channels.master.unmute(false, null, true);
    $(iconDOM).removeClass("is--disabled");
    $(iconDOM).find("i").removeClass("fa-volume-off").addClass("fa-volume-up");
  } else {
    _$.audio.audioEngine.channels.master.mute(false, null, true);
    $(iconDOM).addClass("is--disabled");
    $(iconDOM).find("i").removeClass("fa-volume-up").addClass("fa-volume-off");
  }
}

/* DESIGN */
function getAppSizeRatio () {
  return document.body.scrollWidth / window.screen.actualWidth;
}

function getDragSpeed () {
  return window.devicePixelRatio / _$.state.appScalar;
}

function fadeIn (elements, callback, duration = 0.5, delay = 0) {
  const tl = new TimelineMax({
    delay,
    onCompleteParams: ["{self}"],
    onComplete: (tween) => {
      if (isFunction(callback)) {
        callback(tween);
      }
    }
  });

  tl.set(elements, { display: "" });
  tl.from(elements, duration, { opacity: 0 });

  return tl;
}

function fadeOut (elements, callback, duration = 0.5, delay = 0) {
  const tl = new TimelineMax({
    delay,
    onCompleteParams: ["{self}"],
    onComplete: (tween) => {
      if (isFunction(callback)) {
        callback(tween);
      }
    }
  });

  tl.to(elements, duration, { opacity: 0 });
  tl.set(elements, { display: "none", clearProps: "opacity" });

  return tl;
}

function isVisibleByUser (element) {
  element = $(element);
  const offset  = _$.utils.getAbsoluteOffset(element);
  const centerX = (offset.left + element.width() / 2);
  const centerY = (offset.top + element.height() / 2);
  const elementFromPoint = _$.utils.getTopElementAt(centerX, centerY);

  return !!$(elementFromPoint).closest(element).length;
}

function getTopElementAt (offsetX, offsetY) {
  return document.elementFromPoint(offsetX / window.devicePixelRatio, offsetY / window.devicePixelRatio);
}

function getAbsoluteOffset (element) {
  element = $(element)[0];
  let top  = 0;
  let left = 0;

  while (element) {
    top     += $(element)[0].offsetTop  || 0;
    left    += $(element)[0].offsetLeft || 0;
    element  = $(element)[0].offsetParent;
  }

  return { left, top };
}

/* DOM */
function addDomObserver (elements, eventName, once = true, mutationType = "add") {
  if (!isArray(elements)) {
    elements = [elements];
  }

  const domObserver = new MutationObserver((mutations) => {
    each(mutations, (mutation) => {
      each(elements, (element) => {
        if ((mutationType === "add" && mutation.addedNodes[0] === $(element)[0]) ||
        (mutationType === "remove" && mutation.removedNodes[0] === $(element)[0])) {
          resolve(element);
        }
      });
    });
  });

  function resolve (element) {
    if (isString(eventName)) {
      // Event
      _$.events.trigger(eventName, element);
    } else {
      // Callback
      eventName(element);
    }

    if (once) {
      domObserver.disconnect();
    }
  }

  domObserver.observe(_$.dom[0], {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
    attributeOldValue: true,
    characterDataOldValue: true
  });

  return domObserver;
}

function getNodeIndex (element) {
  return Array.from($(element)[0].parentNode.children).indexOf($(element)[0]);
}

function getBase64Image (url, callback) {
  return fetch(url).then(response => response.blob()).then(blob => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isFunction(callback)) {
          callback(reader.result);
        }

        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  });
}

/* GAME */
function getUserData () {
  const data     = omit(_$.state.user.attributes, "album");
  data.album   = map(_$.state.user.attributes.album.models, "attributes");
  data.version = _$.app.version;

  return data;
}

function getUID (length = 16, usedList = {}, base = "") {
  const chars      = "0123456789abcdefghijklmnopqrstuvwxyz_";
  let string     = "";
  const charsCount = chars.length;

  for (let i = 0; i < length; i++) {
    string += chars[parseInt(Math.random() * charsCount, 10)];
  }

  string = base + string;
  return usedList[string] ? getUID(length, usedList) : string;
}

function getCardList ()    { return cardList; }
function getCountryList () { return countryList; }

function getRandomName () {
  const names = ["Noctis", "Luna", "Ignis", "Prompto", "Gladiolus", "Regis", "Ardyn", "Iedolas"];
  return names[random(names.length - 1)] + "_" + random(9999);
}

function getRandomCards (options) {
  let i       = 0;
  const cards   = [];
  let matches = [];
  let card;
  let level;

  while (i < options.amount) {
    if (isNil(options.level) && isNil(options.minLevel) && isNil(options.maxLevel)) {
      if (isNil(options.album)) {
        matches = cardList;
      } else {
        matches = options.album.toJSON();
      }
    } else {
      level   = options.level ? options.level : (random(options.minLevel - 1, options.maxLevel - 1) + 1);
      matches = options.album ? options.album.where({ level }) : filter(cardList, { level });
    }

    card = matches[random(matches.length - 1)];

    if (!options.unique || (options.unique && !find(cards, card))) {
      cards.push(card);
      i++;
    }
  }

  return cards;
}

function getDestinationCoord (card, destination) {
  // Offset the card slightly to compensate for drop shadow
  const cardOffsetX = -2;
  const cardOffsetY = 0;

  const destOffsets = getAbsoluteOffset($(destination)[0]);
  const destOffsetX = destOffsets.left;
  const destOffsetY = destOffsets.top;
  const destWidth   = $(destination).width();
  const destHeight  = $(destination).height();

  // Difference in size to center the card on its destination
  const deltaWidth  = destWidth - $(card).width();
  const deltaHeight = destHeight - $(card).height();

  const destX = (destOffsetX + deltaWidth / 2) + cardOffsetX;
  const destY = (destOffsetY + deltaHeight / 2) + cardOffsetY;

  return {
    left : destX,
    top  : destY
  };
}

function getPositionFromCaseName (caseName) {
  return {
    x: parseInt(caseName.match(/\d/g)[0], 10),
    y: parseInt(caseName.match(/\d/g)[1], 10)
  };
}

function getCaseNameFromPosition (position = {}) {
  return "case" + position.x + position.y;
}

function getFormattedNumber (number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getFormattedDate (dateObject = new Date(), options = {}) {
  if (!isDate(dateObject)) {
    dateObject = (new Date(dateObject)).toString() === "Invalid Date" ? new Date() : new Date(dateObject);
  }

  let year = dateObject.getFullYear();
  let month = dateObject.getMonth() + 1;
  let day = dateObject.getDate();
  let hours = dateObject.getHours();
  let minutes = dateObject.getMinutes();
  let seconds = dateObject.getSeconds();

  const date  = `${year}.${month < 10 ? "0" + month : month}.${day < 10 ? "0" + day : day}`;
  let time  = (hours < 10 && options.hoursHH ? "0" + hours : hours) + ":";
  time += (minutes < 10 ? "0" + minutes : minutes);

  if (options.seconds) {
    time += ":" + (seconds < 10 ? "0" + seconds : seconds);
  }

  return { date, time };
}

function getElo (kFactor = 32, min = 0, max = +Infinity) {
  return new Elo(kFactor, min, max);
}

//===============================
// SAVE/LOAD MANAGEMENT
//===============================
function saveData (credentials, onError) {
  if (_$.comm.sessionManager.getSession()) {
    return saveToDb(credentials, onError);
  }

  return saveToStorage();
}

function loadData (data) {
  data = data || _$.utils.getLocalStorage(_$.app.name);
  const type = getSaveDataType(data);

  if (type === "session") {
    return loadFromDb();
  } else if (type === "save") {
    return loadFromStorage(data);
  }
}

function saveToDb (form = {}) {
  const data    = _$.utils.getUserData();
  const profile = omit(data, ["version", "userId", "name", "email"]);
  form = { ...form, name: data.name, profile };

  return _$.comm.sessionManager.updateProfile(form).then((response) => {
    if (response.data && response.data.error) {
      throw response.data.error;
    } else {
      _$.comm.sessionManager.refresh().catch((error) => {
        _$.debug.error("global.js@488", error);
      });
      _$.events.trigger("userDataSaved:toDatabase");
      return response;
    }
  }).catch((error) => {
    _$.debug.error("global.js@494", error);
    throw error;
  });
}

function loadFromDb () {
  return _$.comm.sessionManager.getUser.call(_$.comm.sessionManager).then((userData) => {
    _$.state.user.set({
      userId : userData._id,
      name   : userData.name,
      email  : userData.email
    });

    each(omit(userData.profile, "album"), (value, key) => {
      _$.state.user.set(key, value);
    });

    _$.state.user.setAlbum(userData.profile.album);
    _$.state.user.dataLoaded = true;
    _$.events.trigger("userDataLoaded:fromDatabase");
    return userData;
  }).catch((error) => {
    _$.debug.error("global.js@515", error);
    throw error;
  });
}

function saveToStorage () {
  return _encodeSaveData(_$.utils.getUserData()).then((saveData) => {
    setLocalStorage(_$.app.name, saveData);
    _$.events.trigger("userDataSaved:toStorage");
  }).catch((error) => {
    _$.debug.error("global.js@523", error);
    throw error;
  });
}

function loadFromStorage (storageData) {
  if (!storageData) {
    _$.debug.error("loadFromStorage: No data");
    return Promise.reject();
  }

  return _decodeSaveData(storageData, "save").then((JSONdata) => {
    _$.app.checkUpdates(JSONdata, (updatedData) => {
      each(omit(updatedData, ["album", "version", "userId"]), (value, key) => {
        _$.state.user.set(key, value);
      });

      _$.state.user.setAlbum(updatedData.album);
      _$.state.user.dataLoaded = true;
      _$.events.trigger("userDataLoaded:fromStorage");
    });
  }).catch((error) => {
    _$.debug.error("global.js@545", error);
    throw error;
  });
}

function importSave (saveFile, callback) {
  const blob = URL.createObjectURL(saveFile);

  fetch(blob).then((response) => response.text()).then((data) => {
    _$.app.loadData(data);
    if (isFunction(callback)) {
      callback(data);
    }
    return data;
  });
}

function exportSave (fileName) {
  let data = getLocalStorage(_$.app.name);

  if (!data) {
    _$.debug.error("ExportSave: No data");
    return;
  }

  const timeStamp = new Date();
  const saveTime  = (
    timeStamp.toLocaleDateString() + "-" +
    ((timeStamp.getHours() < 10) ? "0" + timeStamp.toLocaleTimeString() : timeStamp.toLocaleTimeString())
  ).replace(/[^\d+-]/g, "");

  if (!fileName) {
    fileName = _$.app.name + "_" + saveTime + "." + _$.app.saveExt;
  }

  if (typeof data === "object") {
    data = JSON.stringify(data, undefined, 4);
  }

  const blob = new Blob([data], { type: "text/plain" });
  const a    = document.createElement("a");
  const e    = new MouseEvent("click", {
    bubbles       : true,
    cancelable    : false,
    view          : window,
    detail        : 0,
    screenX       : 0,
    screenY       : 0,
    clientX       : 0,
    clientY       : 0,
    ctrlKey       : false,
    altKey        : false,
    shiftKey      : false,
    metaKey       : false,
    button        : 0,
    relatedTarget : null
  });

  a.download            = fileName;
  a.href                = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = ["text/plain", a.download, a.href].join(":");
  a.dispatchEvent(e);
}

function _encodeSaveData (JSONdata, type = "save") {
  const prefix = (type === "save") ? _$.app.saveConfig.savePrefix : _$.app.saveConfig.sessionPrefix;

  return new Promise((resolve) => {
    _$.comm.socketManager.emit("encodeSaveData", { JSONdata, prefix }, (response) => {
      resolve(response.msg);
    });
  });
}

function _decodeSaveData (encodedData, type = "save") {
  const prefix = (type === "save") ? _$.app.saveConfig.savePrefix : _$.app.saveConfig.sessionPrefix;

  if (!isString(encodedData) || encodedData.indexOf(prefix) !== 0) {
    const recognizedType = getSaveDataType(encodedData);
    if (recognizedType) {
      _$.debug.warn("DecodeSave: Data is of " + recognizedType + " type");
    } else {
      _$.debug.error("DecodeSave: Invalid " + type + " data");
    }

    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    _$.comm.socketManager.emit("decodeSaveData", { encodedData, prefix }, (response) => {
      resolve(response.msg);
    });
  });
}

function getEncodedData  (data, type) { return data ? _encodeSaveData(data, type) : Promise.resolve(null); }
function getDecodedData  (data, type) { return data ? _decodeSaveData(data, type) : Promise.resolve(null); }
function getSaveDataType (data) {
  if (isString(data) && data.indexOf(_$.app.saveConfig.savePrefix) === 0) {
    return "save";
  } else if (isString(data) && data.indexOf(_$.app.saveConfig.sessionPrefix) === 0) {
    return "session";
  }

  window.localStorage.removeItem(_$.app.name);
  return false;
}

function checkUpdates (saveData, onUpdateCallback) {
  if (saveData.version === _$.app.version) {
    onUpdateCallback(saveData);
  } else {
    const updatedData = _$.app.updateManager.update(saveData);
    onUpdateCallback(updatedData);
    _$.app.saveData();
  }
}

//===============================
// LOCAL STORAGE
//===============================
function setLocalStorage    (key, value) { window.localStorage.setItem(key, JSON.stringify(value)); }
function getLocalStorage    (key)        { return JSON.parse(window.localStorage.getItem(key)); }
