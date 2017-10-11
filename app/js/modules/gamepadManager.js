import $ from 'jquery';
import { each, some, clone, map, pickBy, isArray, filter, get } from 'lodash';
import { TweenMax } from 'gsap';

import _$ from 'store';

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

const ALIASES = {};

function createXboxAliases () {
  /* eslint-disable guard-for-in */
  for (let axe in MAP_XBOX.axe) {
    ALIASES[MAP_XBOX.axe[axe]] = MAP_PS.axe[axe];
  }

  for (let button in MAP_XBOX.button) {
    ALIASES[MAP_XBOX.button[button]] = MAP_PS.button[button];
  }
  /* eslint-enable */
}

createXboxAliases();

class GamepadCursor {
  constructor (gamepad) {
    this.id            = "cursor_gamepad" + gamepad.index;
    this.gamepad       = gamepad;
    this.dom           = null;
    this.targets       = [];
    this.currentTarget = null;
    this.targetIndex   = -1;
    this.position      = {
      x: 0,
      y: 0
    };
  }

  setup () {
    const dom = $("<div>").attr("id", this.id).addClass("cursor");
    _$.dom.append(dom.hide());
    this.dom = _$.dom.find("#" + this.id);
  }

  remove () {
    if (this.dom) {
      this.dom.fadeOut().remove();
    }
  }

  place (options = {}) {
    options = {
      target : this.currentTarget,
      set    : false,
      ...options
    };

    if (!options.target) {
      this.dom.fadeOut();
      return;
    }

    const targetPosition = _$.utils.getAbsoluteOffset(options.target);
    this.position.x    = targetPosition.left - this.dom.width();
    this.position.y    = targetPosition.top + (($(options.target).height() - this.dom.height()) / 2);

    if (this.dom.not(":visible")) {
      this.dom.fadeIn();
    }

    if (options.set) {
      TweenMax.set(this.dom, { left: this.position.x, top: this.position.y });
    } else {
      TweenMax.to(this.dom, 0.15, { left: this.position.x, top: this.position.y });
    }
  }

  getTargets () {
    const targets = [];

    _$.dom.find("[data-gamepad]").each(function () {
      if (_$.utils.isVisibleByUser(this) && !$(this).hasClass("is--disabled")) {
        targets.push(this);
      }
    });

    return targets;
  }

  updateTargets () {
    this.targets = this.getTargets();

    if (this.dom) {
      this.moveToTarget(this.targets[0], true);
    }
  }

  setTarget (target) {
    this.currentTarget = target || this.targets[0];
    this.targetIndex   = this.targets.indexOf(target);
  }

  getNextTarget () {
    if (++this.targetIndex === this.targets.length) {
      this.targetIndex = 0;
    }

    return this.targets[this.targetIndex];
  }

  getPreviousTarget () {
    if (--this.targetIndex < 0) {
      this.targetIndex = this.targets.length - 1;
    }

    return this.targets[this.targetIndex];
  }

  press () {
    this.dispatchMouseEvent(this.currentTarget, [this.createMouseEvent("mousedown")]);
  }

  release () {
    const events = [];
    events.push(this.createMouseEvent("mouseup"));
    events.push(this.createMouseEvent("click"));
    this.dispatchMouseEvent(events);
  }

  moveToTarget (newTarget, noTransition) {
    const currentTargetEvents = [];
    const newTargetEvents     = [];

    if (this.currentTarget) {
      $(this.currentTarget).removeClass("is--hover");
      currentTargetEvents.push(this.createMouseEvent("mouseout", this.currentTarget, { relatedTarget: newTarget }));
      currentTargetEvents.push(this.createMouseEvent("mouseleave", this.currentTarget, { relatedTarget: newTarget }));
    }

    this.setTarget(newTarget);

    $(newTarget).addClass("is--hover");
    newTargetEvents.push(this.createMouseEvent("mouseover", newTarget, { relatedTarget: this.currentTarget }));
    newTargetEvents.push(this.createMouseEvent("mouseenter", newTarget, { relatedTarget: this.currentTarget }));

    this.place({ target: newTarget, set: noTransition });
  }

  dispatchMouseEvent (events, target) {
    target = target || this.currentTarget;
    for (let i = 0, ii = events.length; i < ii; i++) {
      target.dispatchEvent(events[i]);
    }
  }

  createMouseEvent (type, target, options = {}) {
    target = target || this.currentTarget;

    const targetOffset = $(target).offset();
    const eventConfig  = {
      bubbles       : true,
      cancelable    : false,
      view          : window,
      detail        : 0,
      pageX         : targetOffset.left,
      pageY         : targetOffset.top,
      clientX       : targetOffset.left,
      clientY       : targetOffset.top,
      ctrlKey       : false,
      altKey        : false,
      shiftKey      : false,
      metaKey       : false,
      button        : 0,
      relatedTarget : null,
      ...options
    };

    return new MouseEvent(type, eventConfig);
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
    const currentGamepads = (typeof navigator.getGamepads === "function" ? navigator.getGamepads() : void 0) ||
    (typeof navigator.webkitGetGamepads === "function" ? navigator.webkitGetGamepads() : void 0) || [];

    each(currentGamepads, (gamepad, i) => {
      if (gamepad && !this.gamepads[i]) {
        this.connectGamepad(gamepad);
      } else if (!gamepad && this.gamepads[i]) {
        this.disconnectGamepad(this.gamepads[i].pad);
      }
    });

    if (some(this.gamepads) && !this.rAF) {
      this.rAF = requestAnimationFrame(this.updateGamepads.bind(this));

      _$.events.trigger("gamepadOn");
      _$.dom.addClass("useGamepad");
    } else if (!some(this.gamepads) && this.rAF) {
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
        axes    : clone(gamepad.axes),
        buttons : map(gamepad.buttons, (button) => ({ ...button }))
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
    let gamepad;

    /* eslint-disable guard-for-in */
    for (let i in states) {
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
        // eslint-disable-next-line no-lonely-if
        if (states[i]) {
          _$.debug.log("activated gamepad at index", i, "(not connected yet)");
        } else {
          _$.debug.log("deactivated gamepad at index", i, "(not connected yet)");
        }
      }
    }
    /* eslint-enable */

    if (update) {
      states = { ...this.activeStates, ...states };
    }

    this.activeStates = pickBy(states);
  }

  updateActiveGamepads (states) {
    this.setActiveGamepads(states, true);
  }

  activateGamepads (...indexes) {
    if (isArray(indexes[0])) {
      indexes = indexes[0];
    }

    const updatedStates = {};
    each(indexes, (targetIndex) => { updatedStates[targetIndex] = true; });
    this.updateActiveGamepads(updatedStates);
  }

  deactivateGamepads (...indexes) {
    if (isArray(indexes[0])) {
      indexes = indexes[0];
    }

    const updatedStates = {};
    each(indexes, (targetIndex) => { updatedStates[targetIndex] = false; });
    this.updateActiveGamepads(updatedStates);
  }

  isGamepadActive (index) {
    return this.activeStates[index];
  }

  updateGamepads () {
    this.rAF = requestAnimationFrame(this.updateGamepads.bind(this));
    if (this.bypass) { return; }

    this.pollGamepads();
    each(filter(this.gamepads, "active"), (gamepad) => {
      let currentAxes    = gamepad.pad.axes;
      let axes           = gamepad.state.axes;
      let currentButtons = gamepad.pad.buttons;
      let buttons        = gamepad.state.buttons;

      each(currentAxes, (axeValue, i) => {
        let axeName = this.getButtonAlias(this.getButtonName("axe." + i, gamepad));

        if (axeValue !== axes[i]) {
          _$.events.trigger("gamepad:" + axeName + ":valueChange", axeValue, gamepad);
          axes[i] = axeValue;
        }
      });

      each(currentButtons, (buttonState, i) => {
        let buttonName = this.getButtonAlias(this.getButtonName("button." + i, gamepad));

        if (buttonState.pressed !== buttons[i].pressed) {
          if (buttonState.pressed) {
            _$.events.trigger("gamepad:" + buttonName + ":press", buttonState.pressed, gamepad);
          } else {
            _$.events.trigger("gamepad:" + buttonName + ":release", buttonState.pressed, gamepad);
          }

          buttons[i].pressed = buttonState.pressed;
        }

        if (buttonState.value !== buttons[i].value) {
          _$.events.trigger("gamepad:" + buttonName + ":valueChange", buttonState.value, gamepad);
          buttons[i].value = buttonState.value;
        }
      });
    });
  }

  updateCursorTargets () {
    each(this.gamepads, (gamepad) => {
      gamepad.cursor.updateTargets();
    });
  }

  showCursors () {
    each(this.gamepads, (gamepad) => {
      if (gamepad.cursor.dom) {
        gamepad.cursor.dom.fadeIn();
      }
    });
  }

  hideCursors () {
    each(this.gamepads, (gamepad) => {
      if (gamepad.cursor.dom) {
        gamepad.cursor.dom.fadeOut();
      }
    });
  }
  
  getButtonName (buttonLocation, gamepad) {
    let name = get(gamepad.map, buttonLocation);

    if (!name) {
      _$.debug.error("Couldn't find button at", buttonLocation, "for gamepad at", gamepad.pad.index);
    }

    return name;
  }

  getButtonAlias (buttonName) {
    // Returns the original string if no corresponding alias was found
    return get(ALIASES, buttonName) || buttonName;
  }
}

export default GamepadManager;
