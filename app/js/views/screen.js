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
            this.isDisabled         = false;

            this.dom.click(this.toggle.bind(this));
            this.reset(true);
        }

        toggle (e) {
            if (this.isDisabled) {
                e.preventDefault();
                return false;
            }

            var closestValidOption = this.getClosestValidOption(e.target);
            var index              = _$.utils.getNodeIndex(closestValidOption);
            var callback           = closestValidOption === this.currentOption ? _.noop : this.onUpdate;

            if (this.dom.hasClass("is--active")) {
                $(window).off("click." + this.name);
                this.dom.removeClass("is--active");

                TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: callback });
                this.currentOption = closestValidOption;
            } else {
                this.dom.addClass("is--active");

                $(window).on("click." + this.name, (clickEvent) => {
                    if (!$(clickEvent.target).parents(this.selector).length) {
                        $(window).off("click." + this.name);
                        this.dom.removeClass("is--active");
                        this.scrollTo(this.currentOption, true);
                    }
                });
            }
        }

        scrollTo (optionSelector, noCallback, checkValidity) {
            var selectedOption = this.dropdownDOM.find(optionSelector);
            var option         = checkValidity ? this.getClosestValidOption(selectedOption) : selectedOption;
            var index          = _$.utils.getNodeIndex(option);
            var callback       = noCallback ? _.noop : this.onUpdate;

            if (index === -1) {
                this.reset();
            } else {
                TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: index * this.height, delay: 0.6, onComplete: callback });
                this.currentOption = option;
            }
        }

        reset (init) {
            var callback = init ? _.noop : this.onUpdate;
            TweenMax.to(this.dropdownDOM[0], 0.4, { scrollTop: this.defaultOptionIndex * this.height, delay: 0.6, onComplete: callback });
            this.currentOption = this.defaultOption;
        }

        remove  () { $(window).off("click." + this.name); }
        disable () { this.isDisabled = true; }
        enable  () { this.isDisabled = false; }

        getClosestValidOption (option) {
            var validOption = $(option).parent().children(":not(.is--disabled)").eq(0);
            return $(option).hasClass("is--disabled") ? validOption : $(option);
        }

        validitateCurrentOption (noUpdate) {
            var closestValidOption = this.getClosestValidOption(this.currentOption);
            var isValid            = this.currentOption === closestValidOption;

            if (!isValid && !noUpdate) {
                this.scrollTo(closestValidOption);
            }

            return isValid;
        }
    }

    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        initialize,
        add,
        remove,
        updateControlsState,
        triggerGamepadAction,
        createDropdown,
        toggleSetting,
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
        onLogout
    });

    function initialize (options = {}) {
        this.eventsDisabled = false;
        this.promptOverlay  = new Elem_PromptOverlay();

        _$.events.on("startUserEvents", _delegate, this);
        _$.events.on("stopUserEvents", _undelegate, this);
        _$.events.on("showError", this.error, this);
        Backbone.View.prototype.initialize.call(this);
    }

    function add () {
        _$.utils.addDomObserver(this.$el, this.updateControlsState.bind(this), true);
        _$.dom.find("#screen").append(this.$el);
    }

    function remove () {
        _$.events.off("startUserEvents", _delegate, this);
        _$.events.off("stopUserEvents", _undelegate, this);
        _$.events.off("gamepad", this.triggerGamepadAction, this);
        _$.events.off("showError", this.error, this);
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

    function toggleSetting (selector, toggleSelector, state) {
        var dom = this.$(selector);

        if (state === "toggle") {
            state = dom.hasClass("is--on") ? false : true;
        }

        if (state) {
            dom.removeClass("is--off").addClass("is--on");
            dom.find(toggleSelector).text("ON");
        } else {
            dom.removeClass("is--on").addClass("is--off");
            dom.find(toggleSelector).text("OFF");
        }
    }

    function error (event, options) {
        _showPrompt.call(this, _.extend(options, { type: "error" }));
    }

    function info (event, options) {
        _showPrompt.call(this, _.extend(options, { type: "info" }));
    }

    function choice (event, options) {
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
        if (_$.state.user.isInGame) {
            this.info(null, {
                titleBold    : "Currently",
                titleRegular : "in-game",
                msg          : "All unsaved progress will be lost.",
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

    function toGame (userDeck) {
        if (_$.state.room) {
            // We send the user's selected deck to the opponent
            this.waitForOpponent(_.map(userDeck, "attributes"), proceed.bind(this));
        } else {
            proceed.call(this);
        }

        function proceed () {
            var gameInfo = {
                userDeck : userDeck,
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
        
        this.info(null, {
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
        var tl = new TimelineMax();

        if (_$.ui.screen.id === "screen_game") {
            if (nextScreen === "title") {
                tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 });
                tl.add(_$.ui.footer.toggleLogo("hide"), "-=0.5");
                tl.call(() => { _$.ui.footer.isOpen = false; });
            } else if (nextScreen === "lounge") {
                tl.add(_$.ui.footer.toggleLogo("hide"));
                tl.add(_$.ui.footer.toggleMenu("show"), "-=1.5");
                tl.add(_$.ui.footer.toggleSocial("show"), "-=1.5");
                tl.call(() => { _$.ui.footer.isOpen = true; });
            }
        } else if (nextScreen === "title") {
            tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 });
            tl.add(_$.ui.footer.toggleSocial("hide"), "-=0.5");
            tl.add(_$.ui.footer.toggleMenu("hide"), "-=1.5");
            tl.call(() => { _$.ui.footer.isOpen = false; });
        } else if (nextScreen === "game") {
            tl.add(_$.ui.footer.toggleSocial("hide"));
            tl.add(_$.ui.footer.toggleMenu("hide"), "-=1.5");
            tl.add(_$.ui.footer.toggleLogo("show"), "-=1.5");
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
                    var Screen_Title = require("views/screen_title");
                    _$.ui.screen     = new Screen_Title(options);
                } else if (nextScreen === "lounge") {
                    var Screen_Lounge = require("views/screen_lounge");
                    _$.ui.screen      = new Screen_Lounge(options);
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

    function checkBGMCrossfade (nextScreen) {
        if (_$.ui.screen.id === "screen_game") {
            _$.events.once("startUserEvents", () => {
                if (nextScreen === "menus") {
                    _$.audio.audioEngine.setBGM("bgm.menus");
                } else if (nextScreen === "lounge") {
                    _$.audio.audioEngine.setBGM("bgm.lounge");
                }

                _$.audio.audioEngine.playBGM({ fadeDuration: 2 });
            });
        } else if (_$.ui.screen.id === "screen_lounge") {
            var bgmName = _$.state.room ? "bgm.loungeMenus" : "bgm.menus";

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

    function onLogout (event, message) {
        // Connection errors are already handled by the socket manager
        if (!_.isString(event) || event.match("disconnect|connect_timeout|kick")) {
            return;
        } else if (_$.state.user.get("userId")) {
            // If it's a valid event, we notify the socket manager the user should be logged out on the game server
            _$.comm.socketManager.emit("logout");
        }

        if (event.match("logout|userDeleted")) {
            doLogout.call(this);
        } else {
            this.error(null, {
                msg    : event,
                btnMsg : "Close",
                action : this.closePrompt.bind(this, doLogout.bind(this))
            });
        }

        function doLogout () {
            _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
            TweenMax.to(_$.dom, 1, { opacity: 0,
                onComplete: () => {
                    if (_$.audio.audioEngine.currentBGM.getState() === "ended") {
                        proceed.call(this);
                    } else {
                        _$.events.once(_$.audio.audioEngine.currentBGM.events.ended, proceed.bind(this));
                    }
                }
            });

            function proceed () {
                this.changeScreen("title", { setup: true, fullIntro: true });
            }   
        }                
    }
});
