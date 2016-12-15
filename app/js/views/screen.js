define([
    "jquery",
    "underscore", 
    "backbone",
    "global"
], function Screen ($, _, Backbone, _$) {
    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        add,
        show,
        hide
    });

    function add () {
        _$.events.on("stopUserEvents", () => { this.undelegateEvents(); });
        _$.events.on("startUserEvents", () => { this.delegateEvents(); });
        
        $(_$.dom).find("#screen").append(this.$el);
    }

    function show () {
        TweenMax.set(this.$el, { clearProps:"display" });
    }

    function hide () {
        TweenMax.set(this.$el, { display:"none" });
    }
});
