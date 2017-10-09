import $ from 'jquery';
import { uniqBy, find, map, take, each, template } from 'lodash';
import Backbone from 'backbone';

import _$ from 'store';
import Model_Card from './../../../../models/Card';
import Screen from './../Screen';
import Elem_AlbumCard from './../../../components/AlbumCard';
import Templ_cardAlbum from './template.ejs';

const CARDS_PER_LINE = 9;

export default Screen.extend({
    id       : "screen_cardAlbum",
    template : template(Templ_CardAlbum),
    events   : {
        "click .cardAlbum_content-screenNav-choice-backBtn" : function () { this.transitionOut("title"); },
        "mouseenter .cardAlbum_content-screenNav-choice-element" : function () {
            _$.audio.audioEngine.playSFX("uiHover");
        },
        "click .cardAlbum_content-screenNav-choice-element" : function () {
            _$.audio.audioEngine.playSFX("uiConfirm");
        },
        "mouseenter .cardAlbum_content-album-card-visual" : function () {
            _$.audio.audioEngine.playSFX("cardSort");
        }
    },

    initialize,
    remove,

    createAlbumCardViews,

    transitionIn,
    transitionOut
});

function initialize (options) {
    Screen.prototype.initialize.call(this);

    var cardList          = _$.utils.getCardList();
    this.userAlbum        = _$.state.user.get("album");
    this.albumCardViews   = [];
    this.uniqueCopies     = uniqBy(this.userAlbum.models, "attributes.cardId");
    this.knownCardsModels = map(_$.state.user.get("knownCards"), (cardId) => {
        return new Model_Card(find(cardList, { cardId: cardId }));
    });

    this.$el.html(this.template({
        ownedCardsCount   : this.userAlbum.length,
        totalCardsCount   : cardList.length,
        uniqueCopiesCount : this.uniqueCopies.length
    }));

    this.createAlbumCardViews();

    _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
    this.add();
}

function remove () {
    Screen.prototype.remove.call(this);
}

function transitionIn () {
    _$.events.trigger("stopUserEvents");

    var tl = new TimelineMax();
    tl.set(this.$(".cardAlbum_content-album-scroll"), { clearProps: "opacity" });
    tl.set(this.$(".cardAlbum_content-album-cardWrapper"), { opacity: 0 });
    tl.call(() => {
        this.$(".cardAlbum_header").slideDown(this.transitionSettings.slides * 1000);
    });
    tl.staggerTo(
        take(this.$(".cardAlbum_content-album-cardWrapper"), CARDS_PER_LINE * 2),
        this.transitionSettings.slides,
        { opacity: 1, clearProps: "all" },
        this.transitionSettings.staggers,
        `+=${this.transitionSettings.slides}`
    );
    tl.call(() => {
        this.$(".cardAlbum_content-screenNav").slideDown(this.transitionSettings.slides * 1000);
        _$.events.trigger("startUserEvents");
    }, null, [], `-=${this.transitionSettings.slides}`);

    return this;
}

function transitionOut (nextScreen, fromMenu) {
    _$.events.trigger("stopUserEvents");

    var tl = new TimelineMax();
    tl.call(() => {
        this.$(".cardAlbum_content-screenNav, .cardAlbum_content-confirm").slideUp(this.transitionSettings.slides * 1000);
    });
    tl.to(this.$(".cardAlbum_content-album-scroll"), this.transitionSettings.slides, { opacity: 0 }, tl.recent().endTime() + this.transitionSettings.slides);
    tl.call(() => {
        this.$(".cardAlbum_header").slideUp(this.transitionSettings.slides * 1000);
    });
    tl.add(this.checkFooterUpdate(nextScreen), 0);
    tl.call(() => {
        this.changeScreen(nextScreen, fromMenu);
    }, null, [], `+=${this.transitionSettings.slides}`);

    return this;
}

function createAlbumCardViews () {
    var copiesCount;
    var albumCardView;

    each(this.knownCardsModels, (card) => {
        copiesCount   = this.userAlbum.where({ cardId: card.get("cardId") }).length;
        albumCardView = new Elem_AlbumCard({ card, copiesCount, screen: this });

        this.albumCardViews.push(albumCardView);
        this.$(".cardAlbum_content-album-scroll").append($("<div class='cardAlbum_content-album-cardWrapper'>").append(albumCardView.$el));
    });
}
