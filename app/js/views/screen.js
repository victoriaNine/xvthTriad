define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/elem_promptOverlay",
], function Screen ($, _, Backbone, _$, Elem_PromptOverlay) {
    class Dropdown {
        constructor (options = {}) {
            this.screen             = options.screen;
            this.selector           = options.selector;
            this.dom                = this.screen.$(this.selector);
            this.dropdownDOM        = this.dom.find(options.dropdownSelector);
            this.defaultOption      = options.defaultOptionSelector ? this.dropdownDOM.find(options.defaultOptionSelector) : this.dropdownDOM.find("li").eq(0);
            this.defaultOptionIndex = _$.utils.getNodeIndex(this.defaultOption);
            this.height             = options.height || this.dom.height();
            this.name               = _.camelCase(this.selector);
            this.onUpdate           = options.onUpdate || _.noop;
            this.currentOption      = null;

            this.dom.click(this.toggle.bind(this));
            this.reset(true);
        }

        toggle (e) {
            var closestValidOption = $(e.target).hasClass("is--disabled") ? $(e.target).parent().children(":not(.is--disabled)").eq(0) : $(e.target);
            var index              = _$.utils.getNodeIndex(closestValidOption);

            if (this.dom.hasClass("is--active")) {
                $(window).off("click." + this.name);
                this.dom.removeClass("is--active");

                TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: this.onUpdate });
                this.currentOption = closestValidOption;
            } else {
                this.dom.addClass("is--active");

                $(window).on("click." + this.name, (clickEvent) => {
                    if (!$(clickEvent.target).parents(this.selector).length) {
                        $(window).off("click." + this.name);
                        this.dom.removeClass("is--active");
                        this.reset();
                    }
                });
            }
        }

        scrollTo (optionSelector) {
            var option = this.dropdownDOM.find(optionSelector);
            var index  = _$.utils.getNodeIndex(option);

            if (index === -1) {
                this.reset();
            } else {
                TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: this.onUpdate });
                this.currentOption = option;
            }
        }

        reset (init) {
            var callback = init ? _.noop : this.onUpdate;
            TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: this.defaultOptionIndex * this.height, delay: 0.6, onComplete: callback });
            this.currentOption = this.defaultOption;
        }

        remove () {
            $(window).off("click." + this.name);
        }
    }

    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        add,
        remove,
        updateControlsState,
        triggerGamepadAction,
        createDropdown,
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

        if (_$.comm.sessionManager) {
            _$.comm.sessionManager.on("logout", (event, message) => {
                if (event !== "Logged out") {
                    this.error(event, {
                        msg    : event,
                        btnMsg : "Close",
                        action : this.closePrompt.bind(this, doLogout.bind(this))
                    });
                } else {
                    doLogout.call(this);
                }

                function doLogout () {
                    _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
                    TweenMax.to(_$.dom, 1, { opacity: 0,
                        onComplete: () => {
                            if (_$.audio.audioEngine.currentBGM.getState() === "ended") {
                                proceed.call(this);
                            } else {
                                _$.events.once("bgmEnded", proceed.bind(this));
                            }
                        }
                    });

                    function proceed () {
                        this.changeScreen("title", { setup: true, resetUser: true, fullIntro: true });
                    }   
                }                
            });
        }

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

    function createDropdown (options = {}) {
        return new Dropdown(_.defaults(options, { screen: this }));
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
        if (_$.state.inGame) {
            this.info(null, {
                titleBold    : "Currently",
                titleRegular : "in-game",
                msg          : "All unsaved progress will be lost. Do you really wish to leave?",
                btnMsn       : "Cancel"
            });

            var confirmationMessage = "All unsaved progress will be lost. Do you really wish to leave?";
            (e || window.event).returnValue = confirmationMessage;     // Gecko and Trident
            return confirmationMessage;                                // Gecko and WebKit
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
        _$.app.track("set", {
            "dimension0" : "currentScreenId",
            "dimension1" : "fromMenu"
        });
        _$.app.track("send", "event", {
            eventCategory : "screenChange",
            eventAction   : nextScreen,
            dimension0    : _$.ui.screen.id.replace("screen_", ""),  // fromScreen
            dimension1    : !!options.fromMenu                       // fromMenu
        });

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
