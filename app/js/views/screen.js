define([
    "jquery",
    "underscore", 
    "backbone",
    "global"
], function Screen ($, _, Backbone, _$) {
    return Backbone.View.extend({
        tagName   : "section",
        className : "screen",

        add       : add
    });

    function add () {
        $(_$.dom).find("#screen").append(this.$el);
    }
});
