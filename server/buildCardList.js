import { reject } from 'lodash';
import fs from 'fs';

import level1 from './../client/js/data/cards/level1.json';
import level2 from './../client/js/data/cards/level2.json';
import level3 from './../client/js/data/cards/level3.json';
import level4 from './../client/js/data/cards/level4.json';
import level5 from './../client/js/data/cards/level5.json';
import level6 from './../client/js/data/cards/level6.json';
import level7 from './../client/js/data/cards/level7.json';
import level8 from './../client/js/data/cards/level8.json';
import level9 from './../client/js/data/cards/level9.json';
import level10 from './../client/js/data/cards/level10.json';

export function buildCardList () {
  const cardList = reject([
    ...level1,
    ...level2,
    ...level3,
    ...level4,
    ...level5,
    ...level6,
    ...level7,
    ...level8,
    ...level9,
    ...level10
  ], 'bypass');

  const data = JSON.stringify(cardList, null, '\t');

  return new Promise((resolve, reject) => {
    fs.writeFile('client/js/data/cardList.json', data, 'utf8', (err) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    });
  });
}
