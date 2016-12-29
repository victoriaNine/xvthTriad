define(["underscore", "backbone", "global", "collections/coll_album"], function Model_User (_, Backbone, _$, Coll_Album) {
    return Backbone.Model.extend({
        defaults : {
            name       : null,
            avatar     : null,
            album      : new Coll_Album(),
            difficulty : "normal",
            gameStats  : {
                won  : 0,
                lost : 0,
                draw : 0
            }
        },

        setup,
        setAvatarPath
    });

    function setup (options) {
        var name          = _$.utils.getRandomName();
        var characterName = name.match(/[^\_\d]/g).join("");
        var avatarUrl     = "./assets/img/avatars/user_" + characterName.toLowerCase() + ".jpg";

        var initialAlbum = new Coll_Album(_$.utils.getRandomCards({
            amount : 7,
            level  : 1,
            unique : true
        }));

        this.set({ name, album: initialAlbum });
        this.setAvatarPath(avatarUrl);
    }

    function setAvatarPath (url) {
        _$.utils.getBase64Image(url, (base64URL) => {
            this.set({ avatar: base64URL });
            fetch(this.get("avatar")); // Pre-load the user's avatar
        });
    }
});
