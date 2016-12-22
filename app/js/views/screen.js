define([
    "jquery",
    "underscore", 
    "backbone",
    "global"
], function Screen ($, _, Backbone, _$) {
    return Backbone.View.extend({
        tagName        : "section",
        className      : "screen",
        eventsDisabled : false,

        add,
        remove,
        updateControlsState,
        triggerGamepadAction
    });

    function add () {
        _$.utils.addDomObserver(this.$el, this.updateControlsState.bind(this), true);
        _$.events.on("startUserEvents", _delegate.bind(this));
        _$.events.on("stopUserEvents", _undelegate.bind(this));
        _$.dom.find("#screen").append(this.$el);
    }

    function remove () {
        _$.events.off("startUserEvents", _delegate.bind(this));
        _$.events.off("stopUserEvents", _undelegate.bind(this));
        _$.events.off("gamepad", this.triggerGamepadAction.bind(this));
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
        _$.events.on("gamepad", this.triggerGamepadAction.bind(this));
    }

    function _undelegate () {
        _$.controls.gamepadManager.hideCursors();
        _$.events.off("gamepad", this.triggerGamepadAction.bind(this));
        this.undelegateEvents();
        this.eventsDisabled = true;
    }
});
