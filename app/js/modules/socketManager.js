define(["underscore", "global"], function socketManager (_, _$) {
    var socket = require("socketIO");

    class SocketManager {
        constructor () {
            this.socket = socket({ timeout: 15 * 60 * 1000 });
            this.client = this.socket.io;

            this.client.on("connect_timeout", () => {
                 _$.events.trigger("showServerError", {
                    type : "error",
                    msg  : "Connection timed out."
                 });
            });

            this.socket.on("disconnect", () => {
                 _$.events.trigger("showServerError", {
                    type : "error",
                    msg  : "Connection lost."
                 });
            });

            this.socket.on("in:otherPlayerLeft", (msgFromServer) => {
                _$.events.trigger("showServerError", msgFromServer);
            });

            this.socket.on("in:emitEventToClient", (msgFromServer) => {
                _$.events.trigger(msgFromServer.eventName, msgFromServer);
            });

            this.socket.on("in:emitEventToOpponent", (msgFromServer) => {
                _$.events.trigger(msgFromServer.eventName, msgFromServer);
            });

            this.socket.on("in:getRules", (msgFromServer) => {
                _$.events.trigger("getRules", msgFromServer);
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
        }

        emit (eventName, data = {}, callback = null) {
            if (callback) {
                this.socket.once("in:" + eventName, callback);
            }

            this.socket.emit("out:" + eventName, data);
        }

        emitEventToClient (eventName, clientName, data = {}, callback = _.noop) {
            this.socket.emit("out:emitEventToClient", _.extend(data, { eventName, toClient: clientName, fromClient: this.socket.id }));
        }

        emitEventToOpponent (eventName, data = {}, callback = _.noop) {
            this.socket.emit("out:emitEventToOpponent", _.extend(data, { eventName, fromClient: this.socket.id }));
        }
    }

    return SocketManager;
});
