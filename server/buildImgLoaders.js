import { camelCase, lowerCase } from 'lodash';
import fs from 'fs';

import cardList from './../app/js/data/cardList.json';
import countryList from './../app/js/data/countryList.json';

// Cards
export function buildCardsImgLoader () {
  const cardFileList = cardList.map((card) => ({
    type: 'img.cards',
    name: camelCase(card.name) + '.png'
  }));

  const cardsImgLoader = {
    name  : 'imgCards',
    files : cardFileList
  };

  const data = JSON.stringify(cardsImgLoader, null, '\t');
  return new Promise((resolve, reject) => {
    fs.writeFile('app/js/data/loaders/imgCards.json', data, 'utf8', (err) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    });
  });
}

// Flags
export function buildFlagsImgLoader () {
  const countryFileList = [];

  countryList.forEach((country) => {
    countryFileList.push({
      type: 'img.flags',
      name: '4x3/' + lowerCase(country.code) + '.svg'
    });
  });

  const flagsImgLoader = {
    name: 'imgFlags',
    files: countryFileList
  };

  const data = JSON.stringify(flagsImgLoader, null, '\t');
  return new Promise((resolve, reject) => {
    fs.writeFile('app/js/data/loaders/imgFlags.json', data, 'utf8', (err) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    });
  });
}
