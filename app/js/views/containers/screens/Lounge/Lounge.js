import $ from 'jquery';
import { template, isNil, each, difference, compact, uniq, sortBy, upperFirst, find, lowerCase, isFunction, pick } from 'lodash';
import { TweenMax, TimelineMax, Expo } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_Lounge from './template.ejs';

const URL_REGEXP = /((https?):\/\/)*([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/gi;

export default Screen.extend({
  id        : "screen_lounge",
  template  : template(Templ_Lounge),
  events    : {
    /* eslint-disable object-shorthand */
    "focus .lounge_log-chatbar-input" : function () {
      _$.audio.audioEngine.playSFX("uiInput");
    },
    "click .lounge_userlist-userCard-content-menu-challengeBtn,.lounge_userlist-element-user,.lounge_log-chatbar-label": function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .lounge_userlist-userCard-content-menu-challengeBtn,.lounge_log-chatbar-label": function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "keydown .lounge_log-chatbar-input" : function (e) {
      if (e.which === 13 && !e.shiftKey) {
        if (e.target.value.match(/[^\n]/g)) {
          this.sendMessage();
          e.target.value = "";
        } else {
          e.preventDefault();
        }
        return false;
      }

      const currentLine = e.target.value.substr(0, e.target.selectionStart).split("\n").length;
      const totalLines  = e.target.value.split("\n").length;

      // Up key
      if (e.which === 38 && currentLine === 1) {
        if (this.sentMessagesIndex >= this.sentMessages.length - 1) {
          return;
        }

        this.$(".lounge_log-chatbar-input").val(this.sentMessages[++this.sentMessagesIndex]);
      }

      // Down key
      if (e.which === 40 && currentLine === totalLines) {
        if (this.sentMessagesIndex === -1) {
          return;
        } else if (this.sentMessagesIndex === 0) {
          this.sentMessagesIndex--;
          this.$(".lounge_log-chatbar-input").val("");
          return;
        }

        this.$(".lounge_log-chatbar-input").val(this.sentMessages[--this.sentMessagesIndex]);
      }

      if (isNil(this.typingTimeout)) {
        this.userInfo.isTyping = true;
        _$.comm.socketManager.emit("startedTyping", this.loungeName);
        _addTypingLabel.call(this, this.userInfo.userId);
      }

      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.typingTimeout     = null;
        this.userInfo.isTyping = false;

        _$.comm.socketManager.emit("stoppedTyping", this.loungeName);
        _removeActionLabel.call(this, this.userInfo.userId);
      }, 500);
    },
    "click .lounge_log-chatbar-label" : function () {
      if ($(".lounge_log-chatbar-input")[0].value.match(/[^\n]/g)) {
        this.sendMessage();
        $(".lounge_log-chatbar-input").val("");
      }
    },
    "click .lounge_userlist-element-user" : function (e) {
      const userClassName = e.currentTarget.className.match(/user-(\S*)/);
      const userId        = userClassName[1];

      if (this.userCardId) {
        this.closeUserCard(this.openUserCard.bind(this, userId));
      } else {
        this.openUserCard(userId);
      }
    },
    "scroll .lounge_log-messages-scroll" : function () {
      if (isNil(this.scrollingTimeout)) {
        this.isScrollingMsgs = true;
      }

      clearTimeout(this.scrollingTimeout);
      this.scrollingTimeout = setTimeout(() => {
        this.scrollingTimeout = null;
        this.isScrollingMsgs  = false;
      }, 500);
    },
    "click .lounge_userlist-userCard-content-menu-challengeBtn": "sendChallenge"
    /* eslint-enable */
  },

  initialize,
  remove,
  transitionIn,
  transitionOut,
  addUserToList,
  removeUserFromList,
  sendMessage,
  writeMessage,
  writeServiceMessage,
  writeWelcomeMessage,
  updateTypingUser,
  updatePlayingUser,
  openUserCard,
  closeUserCard,
  sendChallenge,
  receiveChallenge,
  challengeCancelled,
  startChallenge,
  addLeaveListener,
  removeLeaveListener
});

function initialize (options) { // eslint-disable-line no-unused-vars
  // Disable lag smoothing for real time
  TweenMax.lagSmoothing(0);

  Screen.prototype.initialize.call(this);

  this.$el.html(this.template());
  this.userInfo          = { ..._$.state.user.getPlayerInfo(), isTyping: false, opponentId: null };
  this.loungeName        = null;
  this.userlist          = {};
  this.onlineCount       = 0;
  this.typingTimeout     = null;
  this.scrollingTimeout  = null;
  this.isScrollingMsgs   = false;
  this.sentMessages      = [];
  this.sentMessagesIndex = -1;
  this.userCardId        = null;
  this.onLeaveListeners  = {};
  this.userTempl         = this.$(".lounge_userlist-element-user")[0].outerHTML;
  this.msgTempl          = this.$(".lounge_log-messages-message-user")[0].outerHTML;
  this.serviceMsgTempl   = this.$(".lounge_log-messages-message-info")[0].outerHTML;
  this.$(".lounge_userlist-element-user, .lounge_log-messages-message-user, .lounge_log-messages-message-info").remove();

  this.$(".lounge_log-logo").append($(_$.assets.get("svg.ui.logo")));

  this.writeWelcomeMessage();
  this.userlist._deletedUser = {
    userId : "_deletedUser",
    name   : "Deleted user",
    avatar : _$.assets.get("img.avatars.user_default").src,
  };

  _$.comm.socketManager.emit("getLoungeUserlist", null, (data) => {
    _$.debug.log(this.userInfo.userId, "getLoungeUserlist", data);
    this.userlist = data.msg;

    each(this.userlist, (userInfo) => {
      this.addUserToList(userInfo);
    });

    _$.comm.socketManager.emit("getLoungeMessageHistory", null, (data) => {
      _$.debug.log(this.userInfo.userId, "getLoungeMessageHistory", data);
      const messageHistory = data.msg;
      const promises       = [];
      let promise;
      let userInfo;
      let userDoc;

      // Users now gone who have messages in the history will need to have their info loaded from the database;
      let previousUsersIds = [];
      each(messageHistory, (message) => {
        if (message.serviceMsg) {
          if (message.data.userId)      { previousUsersIds.push(message.data.userId); }
          if (message.data.emitterId)   { previousUsersIds.push(message.data.emitterId); }
          if (message.data.receiverId)  { previousUsersIds.push(message.data.receiverId); }
          if (message.data.abortUserId) { previousUsersIds.push(message.data.abortUserId); }
        } else {
          previousUsersIds.push(message.userId);
        }
      });

      // Remove the users still present in the lounge from the list
      previousUsersIds = difference(compact(uniq(previousUsersIds)), Object.keys(this.userlist));

      each(previousUsersIds, (userId) => {
        promise = new Promise((resolve) => {
          // eslint-disable-next-line max-nested-callbacks
          _$.comm.socketManager.emitBatch("getUser", userId, (response) => {
            userDoc  = response.msg;
            userInfo = {
              userId,
              name       : userDoc.name,
              avatar     : userDoc.profile.avatar,
              albumSize  : userDoc.profile.album.length,
              isTyping   : false,
              opponentId : null
            };

            this.userlist[userId] = userInfo;
            resolve(userInfo);
          });
        });

        promises.push(promise);
      });

      // Once we have gathered all necessary information about the users in the lounge
      // We write the message history
      Promise.all(promises).then((responses) => { // eslint-disable-line no-unused-vars
        each(messageHistory, (message) => {
          if (message.serviceMsg) {
            this.writeServiceMessage(message);
          } else {
            if (!this.userlist[message.userId]) {
              message.userId = "_deletedUser";
            }

            this.writeMessage(message, true);
          }
        });

        // Add the listeners for the lounge events
        setupListeners.call(this);
        // If the user has an account...
        if (_$.comm.sessionManager.getSession()) {
          // ... and hasn't previously entered the lounge (ie. isn't back from a game)
          // We notify the game server they should be added to the lounge's userlist
          if (!_$.state.user.isInLounge) {
            _$.comm.socketManager.emit("joinLounge", this.userInfo, (data) => {
              this.loungeName                     = data.msg.name;
              this.userlist[this.userInfo.userId] = this.userInfo;
              this.addUserToList(this.userInfo);
              _$.state.user.isInLounge = true;

              this.$(".lounge_userlist-element-group-count").text(data.msg.onlineCount);
              // We add the UI
              this.add();
            });
          } else {
            // Otherwise, we notify the game server to update the user's info
            _$.comm.socketManager.emit("rejoinLounge", this.userInfo, (data) => {
              this.loungeName                     = data.msg;
              this.userlist[this.userInfo.userId] = this.userInfo;

              // We add the UI
              this.add();
            });
          }
        } else {
          // Otherwise we just add the UI
          this.add();
        }
      });
    });
  });

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);

  if (_$.comm.sessionManager.getSession()) {
    this.$(".lounge_notLoggedIn").remove();
  }

  function setupListeners () {
    _$.events.on("updateUserlist", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      const userInfo = data.msg.userInfo;
      const userId   = data.msg.userId;

      if (data.msg.type === "userJoined") {
        this.userlist[userId] = userInfo;
        this.addUserToList(userInfo);

        this.$(".lounge_userlist-element-group-count").text(data.msg.onlineCount);
      } else if (data.msg.type === "userLeft") {
        // We check for leave listeners for that user
        if (this.onLeaveListeners[userId] && this.onLeaveListeners[userId].length) {
          let newIndex = 0;
          each(this.onLeaveListeners[userId], (listener) => {
            listener.handler.call(listener.context, data);
            if (listener.once) {
              this.onLeaveListeners[userId].splice(newIndex, 1);
            } else {
              newIndex++;
            }
          });

          if (!this.onLeaveListeners[userId].length) {
            delete this.onLeaveListeners[userId];
          }
        }

        this.removeUserFromList(userId);
        delete this.userlist[userId];

        this.$(".lounge_userlist-element-group-count").text(data.msg.onlineCount);
      } else if (data.msg.type === "userUpdate") {
        this.userlist[userId] = userInfo;
      }
    });

    _$.events.on("updateTypingUsers", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      this.updateTypingUser(data.msg);
    });

    _$.events.on("updatePlayingUsers", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      this.updatePlayingUser(data.msg);
    });

    _$.events.on("receiveMessage", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      this.writeMessage(data.msg);
    });

    _$.events.on("serviceMessage", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      this.writeServiceMessage(data.msg);
    });

    _$.events.on("receiveChallenge", (event, data) => {
      _$.debug.log(this.userInfo.userId, event.name, data);
      this.receiveChallenge(data.msg);
    });
  }
}

function remove () {
  _$.events.off("updateUserlist");
  _$.events.off("updateTypingUsers");
  _$.events.off("updatePlayingUsers");
  _$.events.off("receiveMessage");
  _$.events.off("serviceMessage");
  _$.events.off("receiveChallenge");
  Screen.prototype.remove.call(this);
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.from(this.$(".lounge_main"), this.transitionSettings.slides, { opacity : 0, scale: 1.25, clearProps: "all" });
  tl.from(this.$(".lounge_log-logo"), this.transitionSettings.slides, { opacity : 0, scale: 0.85, clearProps: "all" }, 0);
  tl.to(
    this.$(".lounge_log-messages-scroll")[0],
    this.transitionSettings.longScroll,
    { scrollTop: this.$(".lounge_log-messages-scroll")[0].scrollHeight, ease: Expo.easeInOut },
    this.transitionSettings.slides / 2
  );
  if (!_$.comm.sessionManager.getSession()) {
    tl.call(() => { this.$(".lounge_notLoggedIn").addClass("is--active"); }, [], null, this.transitionSettings.slides * 0.9);
  }
  tl.call(() => {
    if (_$.comm.sessionManager.getSession()) {
      _$.events.trigger("startUserEvents");
    } else {
      this.delegateEvents({
        /* eslint-disable object-shorthand */
        "click .lounge_notLoggedIn-confirmBtn" : function () {
          _$.audio.audioEngine.playSFX("uiConfirm");
          this.transitionOut("title");
        },
        "mouseenter .lounge_notLoggedIn-confirmBtn": function () {
          _$.audio.audioEngine.playSFX("uiHover");
        }
        /* eslint-enable */
      });

      this.$(".lounge_notLoggedIn-confirmBtn").slideDown(this.transitionSettings.slides * 1000);
    }
  });

  return this;
}

function transitionOut (nextScreen, options) {
  _$.events.trigger("stopUserEvents");
  this.checkBGMCrossfade(nextScreen);

  const tl = new TimelineMax();
  tl.to(this.$(".lounge_log-logo"), this.transitionSettings.slides, { opacity : 0, scale: 0.85 });
  tl.to(this.$(".lounge_main"), this.transitionSettings.slides, { opacity : 0, scale: 1.25 }, this.transitionSettings.slides / 2);
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(() => {
    if (!_$.state.room) {
      // If we are leaving the lounge
      if (_$.comm.sessionManager.getSession()) {
        _$.comm.socketManager.emit("leaveLounge");
        _$.state.user.isInLounge = false;
      }

      // Re-enable lag smoothing
      TweenMax.lagSmoothing(1000, 16);
      this.changeScreen(nextScreen, options);
    } else if (_$.comm.sessionManager.getSession()) {
      // If we are going to play a match
      _$.utils.addDomObserver(this.$el, () => {
        this.changeScreen(nextScreen, options);
      }, true, "remove");
      this.remove();
    }
  });

  return this;
}

function addUserToList (userInfo) {
  const isCurrentUser = userInfo.userId === this.userInfo.userId;
  const dom           = $(this.userTempl).addClass("user-" + userInfo.userId);

  if (isCurrentUser) { dom.addClass("is--currentUser"); }
  dom.find(".lounge_userlist-element-user-avatar-img").css("backgroundImage", "url(" + userInfo.avatar + ")");
  dom.find(".lounge_userlist-element-user-label-name").text(userInfo.name);

  if (userInfo.opponentId) {
    _addPlayingLabel.call(this, userInfo.userId, dom);
  } else if (userInfo.isTyping) {
    _addTypingLabel.call(this, userInfo.userId, dom);
  }

  // Sort the userlist alphabetically
  const sortedList  = sortBy(this.userlist, "name");
  const sortedIndex = sortedList.indexOf(userInfo);
  if (sortedIndex !== 0 && this.$(".lounge_userlist-element-user").eq(sortedIndex - 1).length) {
    this.$(".lounge_userlist-element-user").eq(sortedIndex - 1).after(dom);
  } else {
    this.$(".lounge_userlist-scroll .group-all").after(dom);
  }
}

function removeUserFromList (userId) {
  this.$(".user-" + userId).remove();
  if (userId === this.userCardId) {
    this.closeUserCard();
  }
}

function sendMessage () {
  const text = this.$(".lounge_log-chatbar-input").val();
  const msg  = {
    userId   : this.userInfo.userId,
    text,
    date     : new Date().toJSON(),
    roomName : this.loungeName
  };

  _$.comm.socketManager.emit("sendMessage", msg);
  this.writeMessage(msg);

  this.sentMessages.unshift(text);
  if (this.sentMessages.length > 50) {
    this.sentMessages.pop();
  }
}

function writeMessage (msgData, isFromHistory) {
  const isCurrentUser = msgData.userId === this.userInfo.userId;
  const dom           = $(this.msgTempl);
  const logDom        = this.$(".lounge_log-messages-scroll");
  const userInfo      = this.userlist[msgData.userId];

  let parsedText = msgData.text;
  // eslint-disable-next-line no-useless-escape
  parsedText     = parsedText.replace(/[\u00A0-\u9999<>\&]/gim, (i) => { return "&#" + i.charCodeAt(0) + ";"; }).replace(/\n/, "<br>");

  const userNameRe   = new RegExp(this.userInfo.name, "gi");
  const userMentions = parsedText.match(userNameRe);

  if (userMentions) {
    userMentions.forEach((substr) => {
      parsedText  = parsedText.replace(substr, "<span class='weight-bold color-red'>" + substr + "</span>");
    });
  }

  const urls = parsedText.match(URL_REGEXP);
  let url;

  if (urls) {
    urls.forEach((substr) => {
      url        = substr.match(/^(https?)/) ? substr : "//" + substr;
      parsedText = parsedText.replace(substr, "<a href='" + url + "' target='_blank'>" + substr + "</a>");
    });
  }

  const date       = _$.utils.getFormattedDate(msgData.date).date;
  const time       = _$.utils.getFormattedDate(msgData.date, { seconds: true }).time;
  const parsedDate = date + " @ " + time;

  dom.find(".lounge_log-messages-message-user-avatar-img").css("backgroundImage", "url(" + userInfo.avatar + ")");
  dom.find(".lounge_log-messages-message-user-content-name span").eq(0).text(userInfo.name);
  dom.find(".lounge_log-messages-message-user-content-text").html(parsedText);
  dom.find(".lounge_log-messages-message-user-content-date").text(parsedDate);

  if (isCurrentUser) {
    dom.addClass("is--currentUser");
  } else {
    if (userInfo.userId === "_deletedUser") {
      dom.addClass("is--deletedUser");
    }

    if (!isFromHistory && ((_$.state.user.get("notifyMode") === "always") ||
      (_$.state.user.get("notifyMode") === "onlyMentions" && userMentions) ||
      (_$.state.user.get("notifyMode") === "onlyInactive" && !window.document.hasFocus()))
    ) {
      _$.audio.audioEngine.playNotif("loungeMsg");
    }
  }

  logDom.append(dom);

  if (!this.isScrollingMsgs) {
    TweenMax.to(logDom[0], 0.4, { scrollTop: logDom[0].scrollHeight });
  }
}

function writeServiceMessage (msgData) {
  const userId         = msgData.data.userId;
  const emitterId      = msgData.data.emitterId;
  const receiverId     = msgData.data.receiverId;
  const emitterPoints  = msgData.data.emitterPoints;
  const receiverPoints = msgData.data.receiverPoints;
  const rounds         = msgData.data.rounds;
  const isCurrentUser  = userId === this.userInfo.userId;
  const isEmitter      = emitterId === this.userInfo.userId;
  const isReceiver     = receiverId === this.userInfo.userId;
  const userName       = userId && this.userlist[userId] ? this.userlist[userId].name : "";
  const emitterName    = emitterId && this.userlist[emitterId] ? this.userlist[emitterId].name : "";
  const receiverName   = receiverId && this.userlist[receiverId] ? this.userlist[receiverId].name : "";

  const logDom = this.$(".lounge_log-messages-scroll");
  const dom    = $(this.serviceMsgTempl);
  let domString;

  // TODO: Refactor
  if (msgData.type === "userJoined" || msgData.type === "userLeft") {
    if (msgData.type === "userJoined") {
      domString = "<span class='weight-bold" + (isCurrentUser ? " color-lightBlue'>You</span> have" : "'>" + userName + "</span> has") + " joined the lounge room.";
    } else if (msgData.type === "userLeft") {
      domString = "<span class='weight-bold" + (isCurrentUser ? " color-lightBlue'>You</span> have" : "'>" + userName + "</span> has") + " left the lounge room.";
    }
  }

  if (msgData.type === "challengeSent") {
    if (isEmitter) {
      domString = "<span class='weight-bold color-lightBlue'>You</span> have sent a challenge request to <span class='weight-bold'>" + receiverName + "</span>.";
    } else if (isReceiver) {
      domString = "<span class='weight-bold'>" + emitterName + "</span> has sent <span class='weight-bold color-lightBlue'>you</span> a challenge request.";
    } else {
      return;
    }
  }

  if (msgData.type === "challengeAccepted" || msgData.type === "challengeDeclined") {
    const reply = msgData.type === "challengeAccepted" ? "accepted" : "declined";

    if (isEmitter) {
      domString = "<span class='weight-bold'>" + receiverName + "</span> has " + reply + " <span class='weight-bold color-lightBlue'>your</span> challenge request.";
    } else if (isReceiver) {
      domString = "<span class='weight-bold color-lightBlue'>You</span> have " + reply +
      " <span class='weight-bold'>" + emitterName + "</span>" + (emitterName.charAt(emitterName.length - 1) === "s" ? "'" : "'s") +
      " challenge request.";
    } else {
      return;
    }
  }

  if (msgData.type === "challengeCancelled") {
    if (isEmitter) {
      domString = "<span class='weight-bold color-lightBlue'>You</span> have cancelled the challenge request sent to <span class='weight-bold'>" + receiverName + "</span>.";
    } else if (isReceiver) {
      domString = "<span class='weight-bold'>" + emitterName + "</span> has cancelled the challenge request they sent <span class='weight-bold color-lightBlue'>you</span>.";
    } else {
      return;
    }
  }

  if (msgData.type === "gameStart") {
    if (isEmitter) {
      domString = "<span class='weight-bold color-lightBlue'>You</span> have started a duel with <span class='weight-bold'>" + receiverName + "</span>.";
    } else if (isReceiver) {
      domString = "<span class='weight-bold color-lightBlue'>You</span> have started a duel with <span class='weight-bold'>" + emitterName + "</span>.";
    } else {
      domString = "<span class='weight-bold'>" + emitterName + "</span> has challenged <span class='weight-bold'>" + receiverName + "</span> in a duel.";
    }
  }

  if (msgData.type === "gameEnd") {
    let roundsString;

    // Draw
    if (emitterPoints === receiverPoints) {
      roundsString = rounds === 1 ? "." : " (" + rounds + " rounds).";
      if (isEmitter) {
        domString = "<span class='weight-bold color-lightBlue'>Your</span> duel with <span class='weight-bold'>" + receiverName +
        "</span> has ended in a tie" + roundsString;
      } else if (isReceiver) {
        domString = "<span class='weight-bold color-lightBlue'>Your</span> duel with <span class='weight-bold'>" + emitterName +
        "</span> has ended in a tie" + roundsString;
      } else {
        domString = "<span class='weight-bold'>" + emitterName + "</span> and <span class='weight-bold'>" +
        receiverName + "</span>" + (receiverName.charAt(receiverName.length - 1) === "s" ? "'" : "'s") +
        " duel has ended in a tie" + roundsString;
      }
    }

    // Emitter wins
    if (emitterPoints > receiverPoints) {
      roundsString = rounds === 1 ? ")" : " / " + rounds + " rounds)";
      if (isEmitter) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> won against <span class='weight-bold'>" + receiverName +
        "</span>! (You: " + emitterPoints + " / " + receiverName + ": " + receiverPoints + roundsString;
      } else if (isReceiver) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> lost against <span class='weight-bold'>" + emitterName +
        "</span>. (You: " + receiverPoints + " / " + emitterName + ": " + emitterPoints + roundsString;
      } else {
        domString = "<span class='weight-bold'>" + emitterName + "</span> won against <span class='weight-bold'>" + receiverName +
        "</span>! (" + emitterName + ": " + emitterPoints + " / " + receiverName + ": " + receiverPoints + roundsString;
      }
    }

    // Receiver wins
    if (receiverPoints > emitterPoints) {
      roundsString = rounds === 1 ? ")" : " / " + rounds + " rounds)";
      if (isEmitter) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> lost against <span class='weight-bold'>" + receiverName +
        "</span>. (You: " + emitterPoints + " / " + receiverName + ": " + receiverPoints + roundsString;
      } else if (isReceiver) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> won against <span class='weight-bold'>" + emitterName +
        "</span>! (You: " + receiverPoints + " / " + emitterName + ": " + emitterPoints + roundsString;
      } else {
        domString = "<span class='weight-bold'>" + receiverName + "</span> won against <span class='weight-bold'>" + emitterName +
        "</span>! (" + receiverName + ": " + receiverPoints + " / " + emitterName + ": " + emitterPoints + roundsString;
      }
    }
  }

  if (msgData.type === "gameAbort") {
    const abortUserId        = msgData.data.abortUserId;
    const emitterHasAborted  = abortUserId === emitterId;
    const receiverHasAborted = abortUserId === receiverId;

    if (isEmitter || isReceiver) {
      if (isEmitter && emitterHasAborted) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> have left the duel against <span class='weight-bold'>" + receiverName + "</span>.";
      } else if (isEmitter && receiverHasAborted) {
        domString = "<span class='weight-bold'>" + receiverName + "</span> has left the duel <span class='weight-bold color-lightBlue'>you</span> were in.";
      } else if (isReceiver && emitterHasAborted) {
        domString = "<span class='weight-bold'>" + emitterName + "</span> has left the duel <span class='weight-bold color-lightBlue'>you</span> were in.";
      } else if (isReceiver && receiverHasAborted) {
        domString = "<span class='weight-bold color-lightBlue'>You</span> have left the duel against <span class='weight-bold'>" + emitterName + "</span>.";
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (emitterHasAborted) {
        domString = "<span class='weight-bold'>" + emitterName + "</span> has left the duel against <span class='weight-bold'>" + receiverName + "</span>.";
      } else if (receiverHasAborted) {
        domString = "<span class='weight-bold'>" + receiverName + "</span> has left the duel against <span class='weight-bold'>" + emitterName + "</span>.";
      }
    }

    domString += " (" + upperFirst(msgData.data.reason) + ")";
  }

  dom.html(domString);
  logDom.append(dom);

  if (!this.isScrollingMsgs) {
    TweenMax.to(logDom[0], 0.4, { scrollTop: logDom[0].scrollHeight });
  }
}

function writeWelcomeMessage () {
  const dom    = $(this.serviceMsgTempl);
  const logDom = this.$(".lounge_log-messages-scroll");

  dom.html("Welcome on <span class='weight-bold'>THE FIFTEENTH TRIAD</span>!");
  logDom.append(dom);
}

function updateTypingUser (typingUsers) {
  let userClassName;
  let userId;

  this.$(".lounge_userlist-element-user").each((index, el) => {
    userClassName = el.className.match(/user-(\S*)/);
    userId = userClassName[1];

    if (typingUsers.indexOf(userId) !== -1 && !this.$(el).hasClass("is--active")) {
      _addTypingLabel.call(this, userId);
      this.userlist[userId].isTyping = true;
    } else if (typingUsers.indexOf(userId) === -1 && this.userlist[userId].isTyping && !this.userlist[userId].opponentId) {
      _removeActionLabel.call(this, userId);
      this.userlist[userId].isTyping = false;
    }
  });
}

function updatePlayingUser (playingUsers) {
  let userClassName;
  let userId;

  this.$(".lounge_userlist-element-user").each((index, el) => {
    userClassName = el.className.match(/user-(\S*)/);
    userId = userClassName[1];

    if (playingUsers[userId]) {
      this.userlist[userId].opponentId = playingUsers[userId];
      _addPlayingLabel.call(this, userId);
    } else if (!playingUsers[userId] && this.userlist[userId].opponentId) {
      _removeActionLabel.call(this, userId);
      this.userlist[userId].opponentId = null;
    }
  });
}

function openUserCard (userId) {
  this.userCardId = userId;
  const offset      = _$.utils.getAbsoluteOffset(".user-" + userId);
  const userInfo    = find(this.userlist, { userId });

  this.$(".user-" + userId).addClass("is--selected");
  this.$(".lounge_userlist-userCard-header-avatar-img").css("backgroundImage", "url(" + userInfo.avatar + ")");
  this.$(".lounge_userlist-userCard-header-info-name").text(userInfo.name);
  this.$(".lounge_userlist-userCard-header-info-userId").text(userId);

  if (userInfo.country) {
    this.$(".lounge_userlist-userCard-header-info-flag").addClass("flag-icon flag-icon-" + lowerCase(userInfo.country));
    this.$(".lounge_userlist-userCard-header-info").addClass("has--flag");
  }

  TweenMax.killChildTweensOf(this.$(".lounge_userlist-userCard"));
  const tl = new TimelineMax();
  if (userId === this.userInfo.userId) { tl.set(this.$(".lounge_userlist-userCard-content"), { display: "none" }); }
  tl.set(this.$(".lounge_userlist-userCard"), { clearProps: "display", y: offset.top });
  tl.fromTo(this.$(".lounge_userlist-userCard"), 0.4, { x: "-90%", opacity: 0 }, { x: "-95%", opacity: 1 });
  tl.call(() => {
    $(window).one("click.userCard", (clickEvent) => {
      if (this.userCardId && !$(clickEvent.target).parents(".lounge_userlist-userCard").length) {
        this.closeUserCard();
      }
    });
  });
}

function closeUserCard (callback) {
  $(window).off("click.userCard");

  this.$(".user-" + this.userCardId).removeClass("is--selected");
  this.userCardId = null;

  TweenMax.killChildTweensOf(this.$(".lounge_userlist-userCard"));
  const tl = new TimelineMax();
  tl.fromTo(this.$(".lounge_userlist-userCard"), 0.2, { x: "-95%", opacity: 1 }, { x: "-90%", opacity: 0 });
  tl.set(this.$(".lounge_userlist-userCard"), { display: "none" });
  tl.set(this.$(".lounge_userlist-userCard-content"), { clearProps: "display" });
  tl.call(() => {
    if (isFunction(callback)) {
      callback();
    } else {
      this.$(".lounge_userlist-userCard-header-avatar-img").css("backgroundImage", "");
      this.$(".lounge_userlist-userCard-header-name").text("");
      this.$(".lounge_userlist-userCard-header-userId").text("");
      if (this.$(".lounge_userlist-userCard-header-info").hasClass("has--flag")) {
        this.$(".lounge_userlist-userCard-header-info").removeClass("has--flag");
        each(this.$(".lounge_userlist-userCard-header-info-flag")[0].classList, (className) => {
          if (className.match("flag-icon-")) {
            this.$(".lounge_userlist-userCard-header-info-flag").removeClass(className);
          }
        });
      }
    }
  });
}

function sendChallenge () {
  const opponentId = this.userCardId;
  if (opponentId === this.userInfo.userId) {
    return;
  }
  const opponentName = this.userlist[opponentId].name;
  this.closeUserCard();

  _$.events.once("receiveChallengeReply", onReply, this);

  _$.comm.socketManager.emit("sendChallenge", { to: opponentId }, (response) => {
    _$.debug.log(this.userInfo.userId, "sendChallenge", response);
    if (response.status === "ok") {
      _$.audio.audioEngine.playSFX("challengeSent");
      this.addLeaveListener(opponentId, _onOpponentLeft, this);

      this.info({
        titleBold    : "Please",
        titleRegular : "wait",
        msg          : "Waiting for " + opponentName + " to reply...",
        btnMsg       : "Cancel",
        action       : onCancel.bind(this)
      });
    } else {
      _$.audio.audioEngine.playSFX("uiError");
      _$.events.off("receiveChallengeReply");

      let reasonMsg;
      if (response.msg.reason === "pendingRequest") {
        reasonMsg = opponentName + " already has a pending challenge request";
      } else if (response.msg.reason === "alreadyPlaying") {
        reasonMsg = opponentName + " is already playing";
      } else if (response.msg.reason === "unavailable") {
        reasonMsg = opponentName + " currently cannot receive requests";
      }

      this.info({
        titleBold    : "Player",
        titleRegular : "unavailable",
        msg          : reasonMsg
      });
    }
  });

  function onReply (event, data) {
    _$.debug.log(this.userInfo.userId, event.name, data);
    if (data.msg.reply === "accept") {
      this.userInfo.opponentId = opponentId;
      _$.state.opponent        = pick(this.userlist[this.userInfo.opponentId], Object.keys(_$.state.user.getPlayerInfo()));

      _$.events.once("setupChallengeRoom", (event, data) => {
        _$.comm.socketManager.emit("releasePending");

        _$.debug.log(this.userInfo.userId, event.name, data);
        this.removeLeaveListener(opponentId, _onOpponentLeft);

        _$.audio.audioEngine.playNotif("challengeStart");
        this.closePrompt();
        this.startChallenge(data.msg);
      });

      _$.comm.socketManager.emit("setupChallengeRoom", { with: opponentId });
    } else if (data.msg.reply === "decline") {
      _$.audio.audioEngine.playNotif("gameGain");
      this.removeLeaveListener(opponentId, _onOpponentLeft);

      this.info({
        titleBold    : "Challenge",
        titleRegular : "declined",
        msg          : opponentName + " has declined your challenge request",
        updatePrompt : true,
        action       : this.closePrompt.bind(this, () => {
          _$.comm.socketManager.emit("releasePending");
        })
      });
    }
  }

  function onCancel () {
    _$.events.off("receiveChallengeReply");
    this.removeLeaveListener(opponentId, _onOpponentLeft);
    _$.comm.socketManager.emit("cancelChallenge", { to: opponentId }, (response) => {
      if (response.status === "ok") {
        _$.comm.socketManager.emit("releasePending");
        this.closePrompt();
      } else {
        this.challengeCancelled(response.msg);
      }
    });
  }
}

function receiveChallenge (challengeData) {
  _$.audio.audioEngine.playNotif("gameStart");
  const opponentId   = challengeData.from;
  const opponentName = this.userlist[opponentId].name;

  this.choice({
    titleBold    : "Challenge",
    titleRegular : "request!",
    msg          : opponentName + " challenges you in a duel",
    btn1Msg      : "Accept",
    action1      : onAccept.bind(this),
    btn2Msg      : "Decline",
    action2      : onDecline.bind(this)
  });

  this.addLeaveListener(opponentId, _onOpponentLeft, this);
  _$.events.once("challengeCancelled", (event, data) => {
    _$.debug.log(this.userInfo.userId, event.name, data);
    this.removeLeaveListener(opponentId, _onOpponentLeft);
    this.challengeCancelled(data.msg);
  });

  function onAccept () {
    this.userInfo.opponentId = opponentId;
    _$.state.opponent        = pick(this.userlist[this.userInfo.opponentId], Object.keys(_$.state.user.getPlayerInfo()));

    _$.events.once("setupChallengeRoom", onRoomReady, this);
    _$.comm.socketManager.emit("sendChallengeReply", {
      to    : opponentId,
      reply : "accept"
    }, (response) => {
      this.removeLeaveListener(opponentId, _onOpponentLeft);

      if (response.status !== "ok") {
        _$.events.off("setupChallengeRoom", onRoomReady, this);
        this.challengeCancelled(response.msg);
      }
    });
  }

  function onDecline () {
    this.removeLeaveListener(opponentId, _onOpponentLeft);
    _$.comm.socketManager.emit("sendChallengeReply", {
      to    : opponentId,
      reply : "decline"
    }, (response) => {
      if (response.status === "ok") {
        this.closePrompt();
      } else {
        _$.events.off("setupChallengeRoom", onRoomReady, this);
        this.challengeCancelled(response.msg);
      }
    });
  }

  function onRoomReady (event, data) {
    _$.comm.socketManager.emit("releasePending");

    _$.audio.audioEngine.playNotif("challengeStart");
    _$.debug.log(this.userInfo.userId, event.name, data);

    this.closePrompt();
    this.startChallenge(data.msg);
  }
}

function challengeCancelled (cancelData, opponentName) {
  opponentName = opponentName || (this.userlist[cancelData.from] ? this.userlist[cancelData.from].name : "The player");
  let reasonMsg;

  if (cancelData.reason === "otherPlayerCancelled") {
    _$.audio.audioEngine.playNotif("gameGain");
    reasonMsg = opponentName + " has cancelled the challenge request they sent you";
  } else if (cancelData.reason === "otherPlayerLeft") {
    _$.audio.audioEngine.playNotif("uiError");
    reasonMsg = opponentName + " has left the lounge";
  } else if (cancelData.reason === "otherPlayerDisconnected") {
    _$.audio.audioEngine.playNotif("uiError");
    reasonMsg = opponentName + " has disconnected";
  }

  this.info({
    titleBold    : "Request",
    titleRegular : "cancelled",
    msg          : reasonMsg,
    updatePrompt : true,
    action       : this.closePrompt.bind(this, () => {
      _$.comm.socketManager.emit("releasePending");
    })
  });
}

function startChallenge (roomSettings) {
  _$.state.room = roomSettings;
  this.transitionOut("rulesSelect", { readOnly: _$.state.room.mode === "join" });
}

function addLeaveListener (userId, handlerFn, once, context) {
  if (!this.onLeaveListeners[userId]) {
    this.onLeaveListeners[userId] = [];
  }

  this.onLeaveListeners[userId].push({
    handler : handlerFn,
    once,
    context : context || this
  });
}

function removeLeaveListener (userId, handlerFn) {
  if (!handlerFn) {
    delete this.onLeaveListeners[userId];
  } else {
    let newIndex = 0;
    each(this.onLeaveListeners[userId], (listener) => {
      if (listener.handler === handlerFn) {
        this.onLeaveListeners[userId].splice(newIndex, 1);
      } else {
        newIndex++;
      }
    });
  }
}

function _onOpponentLeft () {
  _$.comm.socketManager.emit("releasePending");
  this.challengeCancelled({ reason: "otherPlayerLeft" });
}

function _addPlayingLabel (userId, dom) {
  const opponentId   = this.userlist[userId].opponentId;
  const opponentName = this.userlist[opponentId].name;
  let label;

  dom   = dom || this.$(".user-" + userId);
  label = dom.find(".lounge_userlist-element-user-label-action");

  label.append($("<span>").text("is playing vs. "));
  label.append($("<span class='weight-bold'>").text(opponentName));
  dom.addClass("is--active");
}

function _addTypingLabel (userId, dom) {
  dom = dom || this.$(".user-" + userId);
  dom.find(".lounge_userlist-element-user-label-action").text("is typing...");
  dom.addClass("is--active");
}

function _removeActionLabel (userId) {
  const dom = this.$(".user-" + userId);
  dom.find(".lounge_userlist-element-user-label-action").empty();
  dom.removeClass("is--active");
}
