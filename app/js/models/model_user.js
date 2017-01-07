define(["underscore", "backbone", "global", "collections/coll_album"], function Model_User (_, Backbone, _$, Coll_Album) {
    return Backbone.Model.extend({
        defaults : {
            userId      : null,
            name        : null,
            avatar      : null,
            album       : new Coll_Album(),
            difficulty  : "easy",
            placingMode : "dragDrop",
            gameStats   : {
                won  : 0,
                lost : 0,
                draw : 0
            },
            bgmVolume   : 1,
            sfxVolume   : 0.5
        },

        initialize,
        setup,
        setAvatarPath
    });

    function initialize () {
        this.dataLoaded = false;
    }

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
        this.dataLoaded = true;
    }

    function setAvatarPath (url) {
        _$.utils.getBase64Image(url, (base64URL) => {
            this.set({ avatar: base64URL });
            fetch(this.get("avatar")); // Pre-load the user's avatar
        });
    }
});
