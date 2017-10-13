import { concat } from 'lodash';
import Backbone from 'backbone';

import _$ from 'common';
import Coll_Album from 'Collections/Album';

export default Backbone.Model.extend({
  defaults : {
    userId         : null,
    name           : null,
    email          : null,
    avatar         : null,
    album          : null,
    knownCards     : [],
    country        : null,
    difficulty     : "easy",
    placingMode    : "dragDrop",
    rankPoints     : 1200,
    lastRankedGame : null,
    daysSinceRG    : 0,
    gameStats   : {
      won        : 0,
      wonRanked  : 0,
      lost       : 0,
      lostRanked : 0,
      draw       : 0,
      drawRanked : 0
    },
    bgmVolume      : 1,
    sfxVolume      : 0.5,
    notifVolume    : 0.5,
    notifyMode     : "always",
    inactiveAudio  : "muteAll"
  },

  initialize,
  setup,
  setAvatarPath,
  setAlbum,
  resetAlbum,
  getPlayerInfo
});

function initialize () {
  this.dataLoaded = false;
  this.avatarURL  = null;
  this.isInGame   = false;
  this.isInLounge = false;

  _$.events.once("userDataLoaded", () => {
    if (!this.get("avatar") && !this.avatarURL) {
      const avatarUrl = _$.assets.get("img.avatars.user_default").src;
      this.setAvatarPath(avatarUrl);
    }
  });
}

function setup (options) { // eslint-disable-line no-unused-vars
  const name          = _$.utils.getRandomName();
  const characterName = name.match(/[^_\d]/g).join("");
  const avatarUrl     = _$.assets.get("img.avatars.user_" + characterName.toLowerCase()).src;

  this.set({ name });
  this.resetAlbum();
  this.setAvatarPath(avatarUrl);
  this.dataLoaded = true;

  _$.events.trigger("userDataLoaded:setup");
}

function setAvatarPath (url) {
  this.avatarURL = url;
  _$.utils.getBase64Image(url, (base64URL) => {
    this.set({ avatar: base64URL });
    fetch(this.get("avatar")); // Pre-load the user's avatar
  });
}

function setAlbum (cards) {
  this.set("album", new Coll_Album(cards));
  this.get("album").on("add", (event, newCard) => {
    if (this.get("knownCards").indexOf(newCard.get("cardId")) === -1) {
      this.set("knownCards", concat(this.get("knownCards"), newCard.get("cardId")));
    }
  });

  // We initialize the array of known cards
  this.get("album").models.forEach((card) => {
    if (this.get("knownCards").indexOf(card.get("cardId")) === -1) {
      this.set("knownCards", concat(this.get("knownCards"), card.get("cardId")));
    }
  });
}

function resetAlbum () {
  this.set("knownCards", []);
  this.setAlbum();
}

function getPlayerInfo () {
  return {
    userId     : this.get("userId"),
    name       : this.get("name"),
    avatar     : this.get("avatar"),
    albumSize  : this.get("album").length,
    country    : this.get("country"),
    rankPoints : this.get("rankPoints")
  };
}
