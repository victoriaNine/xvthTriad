import { isFunction } from 'lodash';
import socket from 'socket.io-client';

import _$ from 'store';

class SocketManager {
  init () {
    this.socket        = socket({ timeout: 15 * 60 * 1000 });
    this.client        = this.socket.io;
    this.callbackQueue = {};

    this.socket.on("connect", (msgFromServer) => {
      _$.events.trigger("connect", msgFromServer);
    });

    this.socket.on("in:socketReady", (msgFromServer) => {
      _$.events.trigger("socketReady", msgFromServer);
    });

    // Connection errors
    this.socket.on("disconnect", (reason) => {
      if (reason.match("kick")) {
        if (_$.comm.sessionManager.getSession()) {
          _$.comm.sessionManager.deleteSession();
        }

        if (reason === "kick:dblConnection") {
          _$.audio.audioEngine.playSFX("menuOpen");
          _$.ui.screen.error({
            msg    : "Another connection to this account has been detected",
            btnMsg : "Refresh",
            action : "refresh"
          });
        }

        return;
      }

      if (_$.comm.sessionManager.getSession()) {
        _$.comm.sessionManager.logout("disconnect");
      }

      _$.audio.audioEngine.playSFX("menuOpen");
      _$.ui.screen.error({
        msg    : "Connection lost",
        btnMsg : "Refresh",
        action : "refresh"
      });
    });

    this.socket.on("connect_timeout", () => {
      if (_$.comm.sessionManager.getSession()) {
        _$.comm.sessionManager.logout("connect_timeout");
      }

      _$.audio.audioEngine.playSFX("menuOpen");
      _$.ui.screen.error({
        msg    : "Connection timed out",
        btnMsg : "Refresh",
        action : "refresh"
      });
    });

    this.socket.on("in:kick", (msgFromServer) => {
      if (msgFromServer.msg.logout) {
        _$.comm.sessionManager.logout("kick").then(() => {
          this.socket.disconnect("kick:" + msgFromServer.msg.reason);
        });
      } else {
        this.socket.disconnect("kick:" + msgFromServer.msg.reason);
      }
    });

    // Game events
    this.socket.on("in:opponentJoined", (msgFromServer) => {
      _$.events.trigger("opponentJoined", msgFromServer);
    });

    this.socket.on("in:getRules", (msgFromServer) => {
      _$.events.trigger("getRules", msgFromServer);
    });

    this.socket.on("in:getElementBoard", (msgFromServer) => {
      _$.events.trigger("getElementBoard", msgFromServer);
    });

    this.socket.on("in:getFirstPlayer", (msgFromServer) => {
      _$.events.trigger("getFirstPlayer", msgFromServer);
    });

    this.socket.on("in:getPlayerAction", (msgFromServer) => {
      _$.events.trigger("getPlayerAction", msgFromServer);
    });

    this.socket.on("in:getSelectedCards", (msgFromServer) => {
      _$.events.trigger("getSelectedCards", msgFromServer);
    });

    this.socket.on("in:playerReset", (msgFromServer) => {
      _$.events.trigger("playerReset", msgFromServer);
      delete _$.state.room;
      delete _$.state.opponent;
    });

    this.socket.on("in:otherPlayerLeft", (msgFromServer) => {
      const reason = msgFromServer.msg.reason;
      let msg;

      if (reason === "disconnection") {
        msg = "Connection with the other player lost";
      } else if (reason === "withdrawal") {
        msg = "The other player left the game";
      }

      _$.audio.audioEngine.playSFX("menuOpen");
      _$.ui.screen.error({
        msg,
        btnMsg : _$.state.user.isInLounge ? "Return to the lounge room" : null, // Will use the default value instead
        action : _$.state.user.isInLounge ? "lounge" : null                     // Will use the defaul value instead
      });
    });


    // Lounge room events
    this.socket.on("in:receiveMessage", (msgFromServer) => {
      _$.events.trigger("receiveMessage", msgFromServer);
    });

    this.socket.on("in:serviceMessage", (msgFromServer) => {
      _$.events.trigger("serviceMessage", msgFromServer);
    });

    this.socket.on("in:updateUserlist", (msgFromServer) => {
      _$.events.trigger("updateUserlist", msgFromServer);
    });

    this.socket.on("in:updateTypingUsers", (msgFromServer) => {
      _$.events.trigger("updateTypingUsers", msgFromServer);
    });

    this.socket.on("in:updatePlayingUsers", (msgFromServer) => {
      _$.events.trigger("updatePlayingUsers", msgFromServer);
    });

    this.socket.on("in:updateOnlineCount", (msgFromServer) => {
      _$.events.trigger("updateOnlineCount", msgFromServer);
    });

    this.socket.on("in:updateLoungeCount", (msgFromServer) => {
      _$.events.trigger("updateLoungeCount", msgFromServer);
    });

    this.socket.on("in:receiveChallenge", (msgFromServer) => {
      _$.events.trigger("receiveChallenge", msgFromServer);
    });

    this.socket.on("in:receiveChallengeReply", (msgFromServer) => {
      _$.events.trigger("receiveChallengeReply", msgFromServer);
    });

    this.socket.on("in:challengeCancelled", (msgFromServer) => {
      _$.events.trigger("challengeCancelled", msgFromServer);
    });

    this.socket.on("in:setupChallengeRoom", (msgFromServer) => {
      _$.events.trigger("setupChallengeRoom", msgFromServer);
    });
  }

  emit (eventName, data = {}, callback = null) {
    if (isFunction(callback)) {
      this.socket.once("in:" + eventName, callback);
    }

    this.socket.emit("out:" + eventName, data);
  }

  emitBatch (eventName, data = {}, callback = null) {
    const self = this;
    let callbackId;

    if (isFunction(callback)) {
      if (!this.callbackQueue["in:" + eventName]) {
        this.callbackQueue["in:" + eventName] = {};
      }

      callbackId = _$.utils.getUID();
      this.callbackQueue["in:" + eventName][callbackId] = callback;
      this.socket.on("in:" + eventName, checkCallback);

      data = { type: "get", callbackId, msg: data };
    } else {
      data = { type: "post", callbackID: null, msg: data };
    }

    this.socket.emit("out:" + eventName, data);

    function checkCallback (response) {
      if (response.callbackId === callbackId) {
        self.socket.off("in:" + eventName, checkCallback);
        callback(response);

        delete self.callbackQueue["in:" + eventName][callbackId];

        if (!Object.keys(self.callbackQueue["in:" + eventName]).length) {
          delete self.callbackQueue["in:" + eventName];
        }
      }
    }
  }
}

export default SocketManager;
