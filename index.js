const fs = require('fs');
const process = require('process')

require('dotenv').config();

const axios = require('axios');

const config = {
    key: process.env.PAGE_SPEED_INSIGHT_KEY,

    serviceUrl: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?category=PERFORMANCE',

    strategies: { desktop: 'DESKTOP', mobile: 'MOBILE' },

    createUrl: (pageUrl, strategy) => {
        return `${config.serviceUrl}&url=${pageUrl}&key=${config.key}&strategy=${strategy}`
    },
}


const sendTelegramBotNotification = message => {
    const botToken = process.env.TELEGRAM_BOT_KEY
    const chatId = process.env.TELEGRAM_CHAT_ID

    const options = {
        method: 'POST',
        url: `https://api.telegram.org/bot${botToken}/sendMessage`,
        headers: {
            accept: 'application/json',
            'content-type': 'application/json'
        },
        data: {
            text: message,
            disable_web_page_preview: true,
            disable_notification: false,
            reply_to_message_id: null,
            chat_id: chatId
        }
    };

    axios
        .request(options)
        .then(function (response) {

        })
        .catch(function (error) {
            console.error(error);
        });
}


// In the Google Console you can see, that there is a daily limit of 25.000 requests and a 100 second limit of 100 requests.
const landings = [] // list of urls
const landingsPerformance = {} // obj of report
const chunkSize = 20 // for 100 second 
const checkTimes = 1 // each landing will be checked times
const queriesDelay = 30 // delay per batch

// loading sites
var array = fs.readFileSync('./sites.txt').toString().split("\n");
for (i in array) {
    landings.push(array[i])
}


const delay = ms => new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve();
    }, ms * 1000)
});

const createArrayOfPromises = (landings, strategy) => {
    const arrayOfPromises = []

    for (let i = 0; i < checkTimes; i++) {
        for (landing of landings) {
            const requestUri = config.createUrl(landing, strategy)
            const axiosPromise = axios.get(requestUri)
            arrayOfPromises.push(axiosPromise)
        }
    }

    return arrayOfPromises
}

const fillLandingDataByStrategy = (promiseResolve, s) => {
    const data = promiseResolve.value.data
    const site = data.id
    const performance = data.lighthouseResult.categories.performance.score

    if (landingsPerformance[site] === undefined) {
        landingsPerformance[site] = {}
    }

    if (landingsPerformance[site][s] === undefined) {
        landingsPerformance[site][s] = []
    }

    landingsPerformance[site][s].push(performance)
}

const sendBatchOfRequests = landings => {
    Promise.allSettled(createArrayOfPromises(landings, config.strategies.desktop))
        .then(promisesDesktop => {
            for (promise of promisesDesktop) {
                if (promise.status == 'fulfilled') {
                    fillLandingDataByStrategy(promise, config.strategies.desktop)
                }
                if (promise.status == 'rejected') {
                    if (promise.reason.response.status == 429) {
                        console.log(promise.reason.response.statusText)
                    } else {
                        console.log(promise.reason.response)
                    }
                    const [errorUrl] = promise.reason.response.config.url.match(/(?<=url\=)(.*?)(?=\&)/)
                    console.log("ERROR URL desktop " + errorUrl)
                    // send url to telegram
                    sendTelegramBotNotification(`
                        [Error][Google page speed] 
${errorUrl}
can\`t check website!
                    `)
                }
            }
        })
}

// create batches by 90
// send all batches with pause 100 sec, first batch without pause
for (let i = 0, d = 0; i < landings.length; i += chunkSize) {
    const chunk = landings.slice(i, i + chunkSize);
    console.log(`making delay ${d * queriesDelay}`)
    delay(d * queriesDelay).then(() => {
        console.log(`checking ${i} batch with ${chunk.length} landings after ${d * queriesDelay} delay`)
        sendBatchOfRequests(chunk)
    })
    d++
}


