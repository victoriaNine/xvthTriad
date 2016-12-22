define(["underscore", "global"], function gamepadManager (_, _$) {
    const MAP_PS = {
        axe : {
            "0"  : "AXIS_LX",
            "1"  : "AXIS_LY",
            "2"  : "AXIS_RX",
            "3"  : "AXIS_RY"
        },
        button : {
            "0"  : "BUTTON_CROSS",
            "1"  : "BUTTON_CIRCLE",
            "2"  : "BUTTON_SQUARE",
            "3"  : "BUTTON_TRIANGLE",
            "4"  : "BUTTON_L1",
            "5"  : "BUTTON_R1",
            "6"  : "BUTTON_L2",
            "7"  : "BUTTON_R2",
            "8"  : "BUTTON_SHARE",
            "9"  : "BUTTON_OPTIONS",
            "10" : "BUTTON_L3",
            "11" : "BUTTON_R3",
            "12" : "BUTTON_UP",
            "13" : "BUTTON_DOWN",
            "14" : "BUTTON_LEFT",
            "15" : "BUTTON_RIGHT",
            "16" : "BUTTON_PS",
            "17" : "BUTTON_TOUCHPAD"
        }
    };

    const MAP_XBOX = {
        axe : {
            "0"  : "AXIS_LX",
            "1"  : "AXIS_LY",
            "2"  : "AXIS_RX",
            "3"  : "AXIS_RY"
        },
        button : {
            "0"  : "BUTTON_A",
            "1"  : "BUTTON_B",
            "2"  : "BUTTON_X",
            "3"  : "BUTTON_Y",
            "4"  : "BUTTON_LB",
            "5"  : "BUTTON_RB",
            "6"  : "BUTTON_LT",
            "7"  : "BUTTON_RT",
            "8"  : "BUTTON_BACK",
            "9"  : "BUTTON_START",
            "10" : "BUTTON_LS",
            "11" : "BUTTON_RS",
            "12" : "BUTTON_UP",
            "13" : "BUTTON_DOWN",
            "14" : "BUTTON_LEFT",
            "15" : "BUTTON_RIGHT"
        }
    };

    const CONTROLLER_TYPE = {
        "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 05c4)" : MAP_PS,
        "Xbox 360 Controller (XInput STANDARD GAMEPAD)" : MAP_XBOX
    };

    var ALIASES = {};

    function setupXboxAliases () {
        for (var axe in MAP_XBOX.axe) {
            ALIASES[MAP_XBOX.axe[axe]] = MAP_PS.axe[axe];
        }

        for (var button in MAP_XBOX.button) {
            ALIASES[MAP_XBOX.button[button]] = MAP_PS.button[button];
        }
    }

    setupXboxAliases();

    class GamepadCursor {
        constructor (gamepad) {
            this.id       = "cursor_gamepad" + gamepad.index;
            this.gamepad  = gamepad;
            this.dom      = null;
            this.targets  = [];
            this.isPlaced = false;
            this.position = {
                x: 0,
                y: 0
            };
        }

        getTargets () {
            var targets = [];

            _$.dom.find("[data-gamepad]").each(function () {
                if (_$.utils.isVisibleByUser(this)) {
                    targets.push(this);
                }
            });

            return targets;
        }

        updateTargets () {
            this.targets = this.getTargets();

            if (this.dom && !this.isPlaced) {
                this.isPlaced = true;
                this.dom.fadeIn();
                this.place({ set: true });
            }
        }

        setup () {
            var dom = $("<div>").attr("id", this.id).addClass("cursor");
            _$.dom.append(dom.hide());
            this.dom = _$.dom.find("#" + this.id);
        }

        remove () {
            this.dom.fadeOut().remove();
            this.isPlaced = false;
        }

        place (options = {}) {
            options = _.defaults(options, {
                target : this.targets[0],
                set    : false
            });

            if (!options.target) {
                this.dom.fadeOut();
                return;
            }

            var targetPosition = _$.utils.getAbsoluteOffset(options.target);
            this.position.x    = targetPosition.left;
            this.position.y    = targetPosition.top;

            var visualX = this.position.x - this.dom.width() * 0.75;

            if (this.dom.not(":visible")) {
                this.dom.fadeIn();
            }

            if (options.set) {
                TweenMax.set(this.dom, { left: visualX, top: this.position.y });
            } else {
                TweenMax.to(this.dom, 0.15, { left: visualX, top: this.position.y });
            }
        }
    }

    class GamepadManager {
        constructor (initStates = {}) {
            this.gamepads     = [];
            this.activeStates = initStates;
            this.rAF          = null;
            this.bypass       = false;

            setInterval(this.pollGamepads.bind(this), 1000);
            this.pollGamepads();
        }

        pollGamepads () {
            var that            = this;
            var currentGamepads = (typeof navigator.getGamepads === "function" ? navigator.getGamepads() : void 0) ||
                                  (typeof navigator.webkitGetGamepads === "function" ? navigator.webkitGetGamepads() : void 0) || [];
            
            _.each(currentGamepads, function (gamepad, i) {
                if (gamepad && !that.gamepads[i]) {
                    that.connectGamepad(gamepad);
                } else if (!gamepad && that.gamepads[i]) {
                    that.disconnectGamepad(that.gamepads[i].pad);
                }
            });

            if (_.some(this.gamepads) && !this.rAF) {
                this.rAF = requestAnimationFrame(this.updateGamepads.bind(this));

                _$.events.trigger("gamepadOn");
                _$.dom.addClass("useGamepad");
            } else if (!_.some(this.gamepads) && this.rAF) {
                cancelAnimationFrame(this.rAF);
                this.rAF = null;

                _$.events.trigger("gamepadOff");
                _$.dom.removeClass("useGamepad");
            }
        }

        connectGamepad (gamepad) {
            _$.debug.log("connected gamepad", gamepad.id, "at index", gamepad.index);
            this.gamepads[gamepad.index] = {
                pad    : gamepad,
                cursor : new GamepadCursor(gamepad),
                active : this.activeStates[gamepad.index] || false,
                map    : CONTROLLER_TYPE[gamepad.id],
                state  : {
                    axes    : _.clone(gamepad.axes),
                    buttons : _.map(gamepad.buttons, (button) => _.extend({}, button))
                }
            };

            if (this.gamepads[gamepad.index].active) {
                this.gamepads[gamepad.index].cursor.setup();
            }
        }

        disconnectGamepad (gamepad) {
            _$.debug.log("disconnected gamepad", gamepad.id, "at index", gamepad.index);
            this.gamepads[gamepad.index].cursor.remove();
            this.gamepads[gamepad.index] = null;
        }

        setActiveGamepads (states, update) {
            var gamepad;

            for (var i in states) {
                gamepad = this.gamepads[i];

                if (gamepad) {
                    if (gamepad.active !== states[i]) {
                        gamepad.active = states[i];

                        if (states[i]) {
                            gamepad.cursor.setup();
                            _$.debug.log("activated gamepad", gamepad.pad.id, "at index", gamepad.pad.index);
                        } else {
                            gamepad.cursor.remove();
                            _$.debug.log("deactivated gamepad", gamepad.pad.id, "at index", gamepad.pad.index);
                        }
                    } else {
                        _$.debug.warn("gamepad", gamepad.pad.id, "at index", gamepad.pad.index, "is already", states[i] ? "active" : "inactive");
                    }
                } else {
                    if (states[i]) {
                        _$.debug.log("activated gamepad at index", i, "(not connected yet)");
                    } else {
                        _$.debug.log("deactivated gamepad at index", i, "(not connected yet)");
                    }
                }
            }

            if (update) {
                states = _.extend(this.activeStates, states);
            }

            this.activeStates = _.pickBy(states);
        }

        updateActiveGamepads (states) {
            this.setActiveGamepads(states, true);
        }

        activateGamepads (...indexes) {
            if (_.isArray(indexes[0])) {
                indexes = indexes[0];
            }

            var updatedStates = {};
            _.each(indexes, (targetIndex) => { updatedStates[targetIndex] = true; });
            this.updateActiveGamepads(updatedStates);
        }

        deactivateGamepads (...indexes) {
            if (_.isArray(indexes[0])) {
                indexes = indexes[0];
            }

            var updatedStates = {};
            _.each(indexes, (targetIndex) => { updatedStates[targetIndex] = false; });
            this.updateActiveGamepads(updatedStates);
        }

        isGamepadActive (index) {
            return this.activeStates[index];
        }

        updateGamepads () {
            this.rAF = requestAnimationFrame(this.updateGamepads.bind(this));
            if (this.bypass) { return; }

            var that = this;

            this.pollGamepads();
            _.each(_.filter(this.gamepads, "active"), (gamepad) => {
                let currentAxes    = gamepad.pad.axes;
                let axes           = gamepad.state.axes;
                let currentButtons = gamepad.pad.buttons;
                let buttons        = gamepad.state.buttons;

                _.each(currentAxes, (axeValue, i) => {
                    let axeName = that.getButtonAlias(that.getButtonName("axe." + i, gamepad));

                    if (axeValue !== axes[i]) {
                        _$.events.trigger("gamepad." + axeName, axeValue, gamepad.pad);
                        axes[i] = axeValue;
                    }
                });

                _.each(currentButtons, (buttonState, i) => {
                    let buttonName = that.getButtonAlias(that.getButtonName("button." + i, gamepad));

                    if (buttonState.pressed !== buttons[i].pressed) {
                        if (buttonState.pressed) {
                            _$.events.trigger("gamepad." + buttonName + ":press", buttonState.pressed, gamepad.pad);
                        } else {
                            _$.events.trigger("gamepad." + buttonName + ":release", buttonState.pressed, gamepad.pad);
                        }

                        buttons[i].pressed = buttonState.pressed;
                    }

                    if (buttonState.value !== buttons[i].value) {
                        _$.events.trigger("gamepad." + buttonName + ":valueChange", buttonState.value, gamepad.pad);
                        buttons[i].value = buttonState.value;
                    }
                });
            });
        }

        updateCursorTargets () {
            _.each(this.gamepads, (gamepad) => {
                gamepad.cursor.updateTargets();
            });
        }

        getButtonName (buttonLocation, gamepad) {
            var name = _.get(gamepad.map, buttonLocation);

            if (!name) {
                _$.debug.error("Couldn't find button at", buttonLocation, "for gamepad at", gamepad.pad.index);
            }

            return name;
        }

        getButtonAlias (buttonName) {
            // Returns the original string if no corresponding alias was found
            return _.get(ALIASES, buttonName) || buttonName;
        }
    }

    return GamepadManager;
});
