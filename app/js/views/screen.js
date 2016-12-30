define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/elem_serverPromptOverlay",
], function Screen ($, _, Backbone, _$, Elem_ServerPromptOverlay) {
    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        add,
        remove,
        updateControlsState,
        triggerGamepadAction,
        error,
        info,
        closePrompt,
        toGame,
        waitForOpponent,
        changeScreen
    });

    function add () {
        this.eventsDisabled = false;
        this.serverPrompt   = new Elem_ServerPromptOverlay();

        _$.utils.addDomObserver(this.$el, this.updateControlsState.bind(this), true);
        _$.events.on("startUserEvents", _delegate, this);
        _$.events.on("stopUserEvents", _undelegate, this);
        _$.events.on("showServerError", this.error, this);
        _$.dom.find("#screen").append(this.$el);
    }

    function remove () {
        _$.events.off("startUserEvents", _delegate, this);
        _$.events.off("stopUserEvents", _undelegate, this);
        _$.events.off("gamepad", this.triggerGamepadAction, this);
        _$.events.off("showServerError", this.error, this);
        Backbone.View.prototype.remove.call(this);
    }

    function updateControlsState () {
        var screenName = this.id.replace("screen_", "");

        if (screenName === "title") {
            if (!_$.controls.gamepadManager.isGamepadActive(0)) {
                _$.controls.gamepadManager.activateGamepads(0);
            }
        }
    }

    function triggerGamepadAction (event, buttonValue, gamepad, originalEvent) {
        originalEvent           = originalEvent.replace("gamepad:", "");
        var buttonName          = originalEvent.split(":")[0];
        var eventType           = originalEvent.split(":")[1];
        var currentTarget       = gamepad.cursor.currentTarget;
        var newTarget           = null;

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

        _$.controls.gamepadManager.showCursors();
        _$.controls.gamepadManager.updateCursorTargets();
        _$.events.on("gamepad", this.triggerGamepadAction, this);
    }

    function _undelegate () {
        _$.controls.gamepadManager.hideCursors();
        _$.events.off("gamepad", this.triggerGamepadAction, this);
        this.undelegateEvents();
        this.eventsDisabled = true;
    }

    function error (eventName, options) {
        _showPrompt.call(this, _.extend(options, { type: "error" }));
    }

    function info (eventName, options) {
        _showPrompt.call(this, _.extend(options, { type: "info" }));
    }

    function closePrompt () {
        this.serverPrompt.close();
    }

    function _showPrompt (options) {
        if (_$.ui.screen.id === this.id) {
            if (!this.serverPrompt.isOpen) {
                _$.utils.addDomObserver(this.serverPrompt.$el, proceed.bind(this), true);
                this.$el.append(this.serverPrompt.$el);
            } else {
                proceed.call(this);
            }
        }

        function proceed () {
            this.serverPrompt.show(options);
        }
    }

    function toGame (deck) {
        if (_$.state.room) {
            this.waitForOpponent({
                deck: _.map(deck, "attributes"),
            }, proceed.bind(this));
        } else {
            proceed.call(this);
        }

        function proceed () {
            var gameInfo = {
                userDeck : deck,
                rules    : _$.state.rules,
                room     : _$.state.room,
                opponent : _$.state.opponent
            };

            this.transitionOut("game", gameInfo);
            _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
            _$.audio.audioEngine.playSFX("titleStart");
        }
    }

    function waitForOpponent (userData, callback) {
        userData = _.extend(userData, {
            name      : _$.state.user.get("name"),
            avatar    : _$.state.user.get("avatar"),
            albumSize : _$.state.user.get("album").length
        });

        _$.comm.socketManager.emit("confirmReady", userData, onResponse.bind(this));
        
        this.info(null, {
            action       : onCancel.bind(this),
            titleBold    : "Please",
            titleRegular : "wait",
            msg          : "Waiting for the other player to confirm"
        });

        function onResponse (response) {
            _$.state.opponent = response;
            fetch(_$.state.opponent.avatar); // Pre-load the opponent's avatar
            this.closePrompt();
            callback();
        }

        function onCancel () {
            _$.comm.socketManager.emit("cancelReady");
            this.closePrompt();
        }
    }

    function changeScreen (nextScreen, options = {}) {
        if (!_$.debug.debugMode) {
            ga("send", "event", {
                eventCategory : "screenChange",
                eventAction   : nextScreen,
                fromScreen    : _$.ui.screen.id.replace("screen_", ""),
                fromMenu      : !!options.fromMenu
            });
        }

        if (nextScreen === "title" || options.fromMenu) {
            if (_$.state.room) {
                _$.comm.socketManager.emit("playerReset");
            }

            delete _$.state.opponent;
            delete _$.state.room;
            delete _$.state.rules;
            delete _$.state.game;
            
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");

                if (nextScreen === "title") {
                    var Screen_Title = require("views/screen_title");
                    _$.ui.screen     = new Screen_Title(options);
                } else if (nextScreen === "userSettings") {
                    var Screen_UserSettings = require("views/screen_userSettings");
                    _$.ui.screen            = new Screen_UserSettings(options);
                } else if (nextScreen === "roomSelect") {
                    var Screen_RoomSelect = require("views/screen_roomSelect");
                    _$.ui.screen          = new Screen_RoomSelect(options);
                } else if (nextScreen === "rulesSelect") {
                    var Screen_RulesSelect = require("views/screen_rulesSelect");
                    _$.ui.screen           = new Screen_RulesSelect(options);
                } else if (nextScreen === "cardsSelect") {
                    var Screen_CardSelect = require("views/screen_cardSelect");
                    _$.ui.screen          = new Screen_CardSelect(options);
                }
            }, true, "remove");
            this.remove();
        } else {
            if (nextScreen === "game") {
                _$.utils.addDomObserver(this.$el, () => {
                    _$.events.trigger("startUserEvents");

                    var Screen_Game = require("views/screen_game");
                    _$.ui.screen = new Screen_Game(options);
                }, true, "remove");
                this.remove();
            } else {
                _$.events.trigger("startUserEvents");
                if (nextScreen === "roomSelect") {
                    var Screen_RoomSelect = require("views/screen_roomSelect");
                    _$.ui.screen          = _$.ui.roomSelect ? _$.ui.roomSelect.transitionIn() : new Screen_RoomSelect(options);
                } else if (nextScreen === "rulesSelect") {
                    var Screen_RulesSelect = require("views/screen_rulesSelect");
                    _$.ui.screen =_$.ui.rulesSelect ? _$.ui.rulesSelect.transitionIn() : new Screen_RulesSelect(options);
                } else if (nextScreen === "cardSelect") {
                    var Screen_CardSelect = require("views/screen_cardSelect");
                    _$.ui.screen =_$.ui.cardSelect ? _$.ui.cardSelect.transitionIn() : new Screen_CardSelect(options);
                }
            }
        }
    }
});
