//  __   __  ___        ___
// |__) /  \  |  |__/ |  |  
// |__) \__/  |  |  \ |  |  

// This is the main file for the faqbot bot.

// Import Botkit's core features
const { Botkit } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

// Import a platform-specific adapter for webex.

const { WebexAdapter } = require('botbuilder-adapter-webex');

const { MongoDbStorage } = require('botbuilder-storage-mongodb');

const { QnAMaker } = require('botbuilder-ai');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
    storage = mongoStorage = new MongoDbStorage({
        url: process.env.MONGO_URI,
    });
}


const adapter = new WebexAdapter({
    access_token: process.env.access_token,
    public_address: process.env.public_address,
    secret: process.env.SECRET
})


const controller = new Botkit({
    debug: true,
    webhook_uri: '/api/messages',

    adapter: adapter,

    storage
});

const qnaMaker = new QnAMaker({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    endpointKey: process.env.QnAAuthKey,
    host: process.env.QnAEndpointHostName
});

controller.middleware.ingest.use(async (bot, message, next) => {
    if (message.incoming_message.type === 'message') {
        const qnaResults = await qnaMaker.getAnswers(message.context);
        if (qnaResults[0]) {
            // If we got an answer, send it directly
            await message.context.sendActivity(qnaResults[0].answer);
            // await bot.reply(message, qnaResults[0].answer); // also works
        } else {
            // If we have no other features, we could just say we didn't find any answers:
            // await message.context.sendActivity('No QnA Maker answers were found.');
            // Otherwise, just forward to the next BotHandler to see if there are any other matches
            next();
        }
    } else {
        next();
    }
});


if (process.env.cms_uri) {
    controller.usePlugin(new BotkitCMSHelper({
        cms_uri: process.env.cms_uri,
        token: process.env.cms_token,
    }));
}

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {

    // load traditional developer-created local custom feature modules
    controller.loadModules(__dirname + '/features');

    /* catch-all that uses the CMS to trigger dialogs */
    if (controller.plugins.cms) {
        controller.on('message,direct_message', async (bot, message) => {
            let results = false;
            results = await controller.plugins.cms.testTrigger(bot, message);

            if (results !== false) {
                // do not continue middleware!
                return false;
            }
        });
    }

});

