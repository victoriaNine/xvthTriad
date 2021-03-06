import $ from 'jquery';
import { template, compact, uniqBy, take, each, without } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'utils';
import Screen from 'Screens/Screen';
import Comp_AlbumCard from 'Components/AlbumCard';
import Templ_CardSelect from './template.ejs';

import svgCardBG from '!svg-inline-loader!Assets/svg/ui/cardBG.svg';

const CARDS_PER_LINE = 9;

export default Screen.extend({
  id       : "screen_cardSelect",
  template : template(Templ_CardSelect),
  events   : {
    /* eslint-disable object-shorthand */
    "click .cardSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("rulesSelect"); },
    "click .cardSelect_content-confirm-choice-yesBtn"    : function () {
      this.toGame(compact(this.userDeck));
    },
    "click .cardSelect_content-confirm-choice-noBtn"     : function () { this.toggleConfirm("hide"); },
    "mouseenter .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "click .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .cardSelect_content-album-card-visual" : function () {
      _$.audio.audioEngine.playSFX("cardSort");
    }
    /* eslint-enable */
  },

  initialize,
  remove,

  toggleConfirm,
  createAlbumCardViews,
  updateDeck,

  transitionIn,
  transitionOut
});

function initialize (options) { // eslint-disable-line no-unused-vars
  Screen.prototype.initialize.call(this);

  _$.ui.cardSelect = this;

  const cardList         = _$.utils.getCardList();
  this.userAlbum       = _$.state.user.get("album");
  this.uniqueCopies    = uniqBy(this.userAlbum.models, "attributes.cardId");
  this.albumCardViews  = [];
  this.userDeck        = [];
  this.holders         = null;
  this.initialized     = false;

  this.$el.html(this.template({
    ownedCardsCount   : this.userAlbum.length,
    totalCardsCount   : cardList.length,
    uniqueCopiesCount : this.uniqueCopies.length
  }));

  this.$(".cardSelect_header-deck-holder").append(svgCardBG);

  this.createAlbumCardViews();
  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function remove () {
  delete _$.ui.cardSelect;
  Screen.prototype.remove.call(this);

  if (_$.ui.roomSelect) {
    _$.ui.roomSelect.remove();
  }

  if (_$.ui.rulesSelect) {
    _$.ui.rulesSelect.remove();
  }
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.set(this.$el, { clearProps: "display" });
  tl.set(this.$(".cardSelect_content-album-scroll"), { clearProps: "opacity" });
  tl.set(this.$(".cardSelect_content-album-cardWrapper"), { opacity: 0 });
  tl.call(() => {
    this.$(".cardSelect_header").slideDown(this.transitionSettings.slides * 1000);
    TweenMax.to(this.$(".cardCopy"), this.transitionSettings.slides, { opacity: 1, clearProps: "opacity", delay: this.transitionSettings.slides });
  });
  tl.staggerTo(
    take(this.$(".cardSelect_content-album-cardWrapper"), CARDS_PER_LINE * 2),
    this.transitionSettings.slides,
    { opacity: 1, clearProps: "all" },
    this.transitionSettings.staggers,
    `+=${this.transitionSettings.slides}`
  );
  tl.call(() => {
    this.$(".cardSelect_content-screenNav").slideDown(this.transitionSettings.slides * 1000);
    _$.events.trigger("startUserEvents");

    if (!this.initialized) {
      this.initialized = true;
      this.holders = {
        holder1 : { dom: this.$("#holder1"), cardView: null },
        holder2 : { dom: this.$("#holder2"), cardView: null },
        holder3 : { dom: this.$("#holder3"), cardView: null },
        holder4 : { dom: this.$("#holder4"), cardView: null },
        holder5 : { dom: this.$("#holder5"), cardView: null }
      };
    }
  }, null, [], `-=${this.transitionSettings.slides}`);

  return this;
}

function transitionOut (nextScreen, fromMenu) {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => {
    this.$(".cardSelect_content-screenNav, .cardSelect_content-confirm").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".cardSelect_content-album-scroll"), this.transitionSettings.slides, { opacity: 0 }, tl.recent().endTime() + this.transitionSettings.slides);
  tl.to(this.$(".cardCopy"), this.transitionSettings.slides, { opacity: 0 }, `-=${this.transitionSettings.slides}`);
  tl.call(() => {
    this.$(".cardSelect_header").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(() => {
    TweenMax.set(this.$el, { display: "none" });
    this.changeScreen(nextScreen, fromMenu);
  }, null, [], `+=${this.transitionSettings.slides}`);

  return this;
}

function createAlbumCardViews () {
  let copiesCount;
  let albumCardView;

  each(this.uniqueCopies, (card) => {
    copiesCount   = this.userAlbum.where({ cardId: card.get("cardId") }).length;
    albumCardView = new Comp_AlbumCard({ card, copiesCount, screen: this });

    this.albumCardViews.push(albumCardView);
    this.$(".cardSelect_content-album-scroll").append($("<div class='cardSelect_content-album-cardWrapper'>").append(albumCardView.$el));
  });
}

function updateDeck (options) {
  const fromHolderIndex = options.moveFrom ? parseInt(options.moveFrom.id.replace(/\D/g, ""), 10) - 1 : -1;
  const toHolderIndex   = options.moveTo ? parseInt(options.moveTo.id.replace(/\D/g, ""), 10) - 1 : -1;

  // If the card was previously in the deck, we free its previous position in both the user's deck and the card holders
  if (options.moveFrom) {
    this.userDeck[fromHolderIndex]             = null;
    this.holders[options.moveFrom.id].cardView = null;
  }

  if (options.action === "remove") {
    // If the user was removing the card from the holder, there is nothing more to update
  } else if (options.action === "add") {
    // If the user was adding a card in the deck, we update the deck and the card holders with the new card
    this.userDeck[toHolderIndex]             = options.albumCardView.cardView.model;
    this.holders[options.moveTo.id].cardView = options.cardCopy;

    // We check whether we need to reorder the deck in case cards have been swapped places
    // For each card in the album, except the one we're placing (card "A")
    each(without(this.albumCardViews, options.albumCardView), (albumCardView) => {
      // We check each of its copies
      each(albumCardView.cardCopies, (cardCopy) => {
        // If one of the copies is in the holder we're moving "A" to
        if (cardCopy.holder === options.moveTo) {
          // And if "A" was already in the deck (the user is reordering the cards in the deck)
          if (options.moveFrom) {
            // We move the card copy where "A" previously was
            albumCardView.moveToDeck(options.moveFrom, cardCopy, true);

            this.userDeck[fromHolderIndex]             = albumCardView.cardView.model;
            this.holders[options.moveFrom.id].cardView = cardCopy;
          } else {
            // If "A" wasn't in the deck (the user is replacing the card with "A")
            // We move the card back to its origin
            albumCardView.moveToOrigin(cardCopy, true);
          }
        }
      });
    });
  }

  if (compact(this.userDeck).length === _$.state.DECK_SIZE) {
    if (!this.$(".cardSelect_content-confirm").is(":visible")) {
      this.toggleConfirm("show");
      _$.audio.audioEngine.playSFX("gameGain");
    }
  } else if (this.$(".cardSelect_content-confirm").is(":visible")) {
    this.toggleConfirm("hide");
  }
}

function toggleConfirm (state) {
  if (state === "show") {
    this.$(".cardSelect_content-confirm").css({pointerEvents: ""}).slideDown();
    this.$(".cardSelect_content-screenNav").css({pointerEvents: "none"}).slideUp();
  } else if (state === "hide") {
    this.$(".cardSelect_content-confirm").css({pointerEvents: "none"}).slideUp();
    this.$(".cardSelect_content-screenNav").css({pointerEvents: ""}).slideDown();
  }
}
