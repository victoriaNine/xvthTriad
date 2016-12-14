define(["underscore", "backbone"], function Model_Card (_, Backbone) {
    return Backbone.Model.extend({
        defaults : {
            name       : "",
            image      : "",
            level      : 1,
            ranks      : {
                top    : 1,
                right  : 1,
                bottom : 1,
                left   : 1
            },
            element      : null
        },

        initialize,
        validate,

        setImagePath,
        getRanksSum
    });

    function initialize (attributes, options) {
        this.owner        = null;
        this.currentOwner = null;
        this.position     = null;
        this.bonus        = 0;

        this.validate(attributes);
        this.setImagePath();
    }

    function validate (attributes, options) {
        if (_.isNil(attributes.name) || !_.isString(attributes.name) || attributes.name === "") {
            return "The card's name needs to be defined.";
        }
    }

    function setImagePath () {
        this.set({ image: "./assets/img/cards/" + _.camelCase(this.get("name")) + ".png" });
    }

    function getRanksSum () {
        return (this.get("ranks").top + this.get("ranks").right + this.get("ranks").bottom + this.get("ranks").left);
    }
});
