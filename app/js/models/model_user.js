define(["underscore", "backbone", "global", "collections/coll_album"], function Model_User (_, Backbone, _$, Coll_Album) {
    return Backbone.Model.extend({
        defaults : {
            name      : _$.utils.getRandomName(),
            avatar    : null,
            album     : null,
            gameStats : {
                win  : 0,
                lost : 0,
                draw : 0
            }
        },

        initialize    : initialize,
        setAvatarPath : setAvatarPath
    });

    function initialize (attributes, options) {
        var initialAlbum = new Coll_Album(_$.utils.getRandomCards({
            amount : 7,
            level  : 1,
            unique : true
        }));

        this.set({ album : initialAlbum });
        this.setAvatarPath();
    }

    function setAvatarPath () {
        var characterName = this.get("name").match(/[^\_\d]/g).join("");
        this.set({ avatar : "./assets/img/avatars/user_" + characterName.toLowerCase() + ".jpg" });
    }
});
