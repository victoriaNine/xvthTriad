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
        updateControlsState
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

    function _delegate () {
        this.delegateEvents();
        this.eventsDisabled = false;

        _$.controls.gamepadManager.updateCursorTargets();
    }

    function _undelegate () {
        this.undelegateEvents();
        this.eventsDisabled = true;
    }
});
