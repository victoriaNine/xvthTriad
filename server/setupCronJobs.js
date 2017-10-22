import { find, reverse, each, map, orderBy, take, uniqBy } from 'lodash';
import { CronJob } from 'cron';
import moment from 'moment-timezone';

export const cronJobs = {};

export default function setupCronJobs (db) {
  const K_FACTOR       = 32;
  /*const DAY_IN_MINUTES = 1440;
  const DAY_IN_SECONDS = 86400;*/
  const DAY_IN_MS      = 86400000;
  const DECAY_RATES    = [
    { days: 7, dailyPenalty: 1 },
    { days: 14, dailyPenalty: 2 },
    { days: 28, dailyPenalty: 5 },
    { days: 56, dailyPenalty: 10 }
  ];

  function findRate (daysSinceRG) {
    return find(reverse(DECAY_RATES.slice(0)), (rate) => { return rate.days <= daysSinceRG; });
  }

  let lastRankedGame, timeElapsed, userDoc, daysSinceRG, daysElapsed, decayRate, rankPoints, needsUpdate, i, ii;
  cronJobs.inactivityPenalty     = { job:null, result: null };
  cronJobs.inactivityPenalty.job = new CronJob({
    cronTime : "00 00 7 * * *", // Everyday at 7am (Paris)
    onTick   : () => {
      let now = new Date();
      db.query("auth/verifiedUsers", { include_docs: true }).then((result) => {
        each(result.rows, (user) => {
          userDoc        = user.doc;
          lastRankedGame = userDoc.profile.lastRankedGame;
          daysSinceRG    = userDoc.profile.daysSinceRG;
          rankPoints     = userDoc.profile.rankPoints;
          timeElapsed    = now - lastRankedGame;
          needsUpdate    = false;

          //console.log(userDoc._id, lastRankedGame, daysSinceRG, rankPoints, timeElapsed);

          if (lastRankedGame && timeElapsed >= DAY_IN_MS) {
            daysElapsed = Math.floor(timeElapsed / DAY_IN_MS);

            for (i = 0, ii = daysElapsed; i < ii; i++) {
              if (rankPoints < 0) {
                rankPoints = 0;
                break;
              }

              decayRate = findRate(++daysSinceRG);

              if (decayRate) {
                rankPoints -= decayRate.dailyPenalty * K_FACTOR;
              }
            }

            userDoc.profile.rankPoints  = rankPoints;
            userDoc.profile.daysSinceRG = daysSinceRG;
            needsUpdate = true;
          } else if (daysSinceRG !== 0) {
            userDoc.profile.daysSinceRG = 0;
            needsUpdate = true;
          }

          if (needsUpdate) {
            db.put(userDoc);
          }
        });
      }).catch((error) => {
        console.error("connect.js@167", error);
      });
    },
    start    : true,
    timeZone : "Europe/Paris"
  });

  cronJobs.rankings     = { job: null, result: {} };
  cronJobs.rankings.job = new CronJob({
    cronTime : "00 00 7 * * *", // Every day at 7am (Paris)
    onTick   : () => {
      /* TODO: Weekly update?
      const from = moment().tz("Europe/Paris").day("monday").startOf("day");
      const to   = moment().tz("Europe/Paris").day(+7).day("sunday").endOf("day");*/
      const from = moment().tz("Europe/Paris").startOf("day").add(7, "hours");
      const to   = moment().tz("Europe/Paris").startOf("day").add(1, "day").add(6, "hours").endOf("hour");

      db.query("auth/verifiedUsers", { include_docs: true }).then((users) => {
        const userDocs = map(users.rows, "doc");
        let tenBest;

        // "Ace of Cards" ranking
        const sortedByElo = orderBy(userDocs, (userDoc) => { return userDoc.profile.rankPoints; }, "desc");
        tenBest         = take(sortedByElo, 10);

        const ranking_aceOfCards = map(tenBest, (userDoc) => {
          const totalGames = userDoc.profile.gameStats.wonRanked + userDoc.profile.gameStats.lostRanked + userDoc.profile.gameStats.drawRanked;
          const stats      = userDoc.profile.gameStats.wonRanked + " / " + totalGames;
          const rate       = ((userDoc.profile.gameStats.wonRanked * 100 / totalGames) || 0).toFixed(2) + "%";

          return {
            name       : userDoc.name,
            avatar     : userDoc.profile.avatar,
            country    : userDoc.profile.country,
            gameStats  : userDoc.profile.gameStats,
            points     : userDoc.profile.rankPoints,
            stats,
            rate,
          };
        });

        while (ranking_aceOfCards.length < 10) {
          ranking_aceOfCards.push({ filler: true });
        }

        cronJobs.rankings.result.aceOfCards = {
          name   : "aceOfCards",
          title  : "Ace of Cards",
          date   : { from, to },
          ranks  : ranking_aceOfCards,
          sortBy : "points"
        };

        // "The Collector" ranking
        const sortedByUnique = orderBy(userDocs, (userDoc) => { return uniqBy(userDoc.profile.album, "cardId").length; }, "desc");
        tenBest              = take(sortedByUnique, 10);

        let ranking_theCollector = map(tenBest, (userDoc) => {
          return {
            name       : userDoc.name,
            avatar     : userDoc.profile.avatar,
            country    : userDoc.profile.country,
            albumSize  : userDoc.profile.album.length,
            uniqueSize : uniqBy(userDoc.profile.album, "cardId").length
          };
        });

        each(ranking_theCollector, (ranker) => {
          const uniqueRate = ranker.uniqueSize * 100 / ranker.albumSize;
          ranker.points  = Math.floor(ranker.uniqueSize * (100 - uniqueRate / 100));
          ranker.stats   = ranker.albumSize;
          ranker.rate    = ranker.uniqueSize;
        });

        ranking_theCollector = orderBy(ranking_theCollector, "points", "desc");

        while (ranking_theCollector.length < 10) {
          ranking_theCollector.push({ filler: true });
        }

        cronJobs.rankings.result.theCollector = {
          name   : "theCollector",
          title  : "The Collector",
          date   : { from, to },
          ranks  : ranking_theCollector,
          sortBy : "points"
        };
      }).catch((error) => {
        console.error("connect.js@254", error);
      });
    },
    start     : true,
    timeZone  : "Europe/Paris",
    runOnInit : true
  });
}
