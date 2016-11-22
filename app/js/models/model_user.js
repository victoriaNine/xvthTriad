define(["underscore", "backbone", "global", "collections/Coll_Collection"], function User (_, Backbone, _$, Collection) {
    return Backbone.Model.extend({
        defaults : {
            name       : _$.utils.getRandomName(),
            avatar     : null,
            collection : null,
        },

        initialize    : initialize,
        setAvatarPath : setAvatarPath
    });

    function initialize (attributes, options) {
        var initialCollection = new Collection(_$.utils.getRandomCards({
            amount : 7,
            level  : 1,
            owner  : this
        }));

        this.set({ collection : initialCollection });
        this.setAvatarPath();
    }

    function setAvatarPath () {
        var characterName = this.get("name").match(/[^\_\d]/g).join("");
        this.set({ avatar : "./assets/img/avatars/user_" + characterName.toLowerCase() + ".jpg" });
    }
});
