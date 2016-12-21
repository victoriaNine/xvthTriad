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
        show,
        hide
    });

    function add () {
        _$.events.on("stopUserEvents", () => { this.undelegateEvents(); this.eventsDisabled = true; });
        _$.events.on("startUserEvents", () => { this.delegateEvents(); this.eventsDisabled = false; });
        $(_$.dom).find("#screen").append(this.$el);
    }

    function show () {
        TweenMax.set(this.$el, { clearProps:"display" });
    }

    function hide () {
        TweenMax.set(this.$el, { display:"none" });
    }
});
