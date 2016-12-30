define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/elem_promptOverlay",
], function Screen ($, _, Backbone, _$, Elem_PromptOverlay) {
    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        add,
        remove,
        updateControlsState,
        triggerGamepadAction,
        error,
        info,
        choice,
        closePrompt,
        showSavePrompt,
        showAutoSavePrompt,
        toGame,
        waitForOpponent,
        changeScreen
    });

    function add () {
        this.eventsDisabled = false;
        this.promptOverlay  = new Elem_PromptOverlay();

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

    function choice (eventName, options) {
        _showPrompt.call(this, _.extend(options, { type: "choice" }));
    }

    function closePrompt () {
        this.promptOverlay.close();
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
        this.choice(null, {
            titleBold    : "Save your",
            titleRegular : "progress",
            msg          : "All unsaved progress will be lost. Do you really wish to leave?",
            btn1Msg      : "Open save screen",
            btn2Msg      : "Cancel",
            action1      : onGoSave.bind(this),
            action2      : this.closePrompt.bind(this)
        });

        var confirmationMessage = "All unsaved progress will be lost. Do you really wish to leave?";
        (e || window.event).returnValue = confirmationMessage;     // Gecko and Trident
        return confirmationMessage;                                // Gecko and WebKit

        function onGoSave () {
            this.promptOverlay.close(() => {
                this.transitionOut("userSettings");
            });
        }
    }

    function showAutoSavePrompt () {
        _$.audio.audioEngine.playSFX("gameGain");

        this.info(null, {
            titleBold    : "Autosave",
            titleRegular : "complete",
            msg          : "Your progress was saved.",
            autoClose    : true
        });
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
            titleBold    : "Please",
            titleRegular : "wait",
            msg          : "Waiting for the other player to confirm",
            btnMsg       : "Cancel",
            action       : onCancel.bind(this)
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

        if (nextScreen === "title" || nextScreen === "userSettings" || options.fromMenu) {
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
            // Game flow
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
