/* eslint-disable no-lone-blocks */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');

const { CampusDialog } = require('./componentDialogs/CampusDialog');
const { DepartmentDialog } = require('./componentDialogs/DepartmentDialog');

const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');

class NSTU101bot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;
        this.dialogState = conversationState.createProperty('dialogState');
        this.departmentDialog = new DepartmentDialog(this.conversationState, this.userState);
        this.campusDialog = new CampusDialog(this.conversationState, this.userState);
        this.previousIntent = this.conversationState.createProperty('previousIntent');
        this.conversationData = this.conversationState.createProperty('conservationData');

        /// dispatch with luis
        const dispatchRecognizer = new LuisRecognizer({
            applicationId: process.env.LuisAppId,
            endpointKey: process.env.LuisAPIKey,
            endpoint: `https://${ process.env.LuisAPIHostName }.api.cognitive.microsoft.com`
        }, {
            includeAllIntents: true
        }, true);

        // dispatch with qna maker
        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        this.qnaMaker = qnaMaker;

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            const luisResult = await dispatchRecognizer.recognize(context);
            const intent = LuisRecognizer.topIntent(luisResult);
            console.log(luisResult);
            console.log(intent);

            const entities = luisResult.entities;

            await this.dispatchToIntentAsync(context, intent, entities);

            // const entities = luisResult.entities;

            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });
        this.onMembersAdded(async (context, next) => {
            await this.sendWelcomeMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;

        // Iterate over all new members added to the conversation.
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = `Welcome to NSTU101 ${ activity.membersAdded[idx].name }. `;
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['Campus', 'Department', 'Admission'], 'What would you like to know today ?');
        await turnContext.sendActivity(reply);
    }

    async dispatchToIntentAsync(context, intent, entities) {
        // console.log(context.activity.text);
        var currentIntent = '';
        const previousIntent = await this.previousIntent.get(context, {});

        const conversationData = await this.conversationData.get(context, {});

        console.log('previousIntent', previousIntent.intentName, 'conversationData', conversationData.endDialog);

        if (previousIntent.intentName && conversationData.endDialog === false) {
            currentIntent = previousIntent.intentName;

            console.log('currentIntent', currentIntent);
        } else if (previousIntent.intentName && conversationData.endDialog === true) {
            currentIntent = intent;

            console.log('currentIntent', currentIntent);
        } else if (intent === 'None' && !previousIntent.intentName) {
            var result = await this.qnaMaker.getAnswers(context);
            const qnaData = result[0].answer.split(';');
            /// qna
            console.log(qnaData);
            const title = qnaData[0];
            const description = qnaData[1];
            const imageUrl = qnaData[2];
            const linkTitle = qnaData[3];
            const url = qnaData[4];
            const syntax = qnaData.length > 1;
            console.log('url', url, syntax);
            const action = CardFactory.actions([
                {
                    type: 'openUrl',
                    title: linkTitle,
                    value: url
                }
            ]);
            const image = CardFactory.images([imageUrl]);
            if (qnaData) {
                if (url) {
                    await context.sendActivity(
                    // `${result[0].answer}`

                        // title, description,imageUrl linkTitle, url
                        {
                            attachments: [CardFactory.heroCard(title, description, image, action
                            )]
                        });
                } else if (!url && syntax) {
                    console.log('answer');
                    await context.sendActivity(
                        // `${result[0].answer}`

                        // title, description,imageUrl linkTitle, url
                        {
                            attachments: [CardFactory.heroCard(title, description, image
                            )]
                        });
                } else if (!syntax) {
                    console.log('answer');
                    await context.sendActivity(
                        `${ result[0].answer }`);
                }
            } else {
                await context.sendActivity(
                    'Not get any answer');
            }

            // //     //     CardFactory.heroCard('Lorem Ipsum 2', 'https://mysite/myimg.jpg', ['action1', 'action2'])],
            // //     // attachmentLayout: 'carousel',
            // //     // text: 'asd'

            // await this.sendSuggestedActions(context);
            console.log(result);
            // await this.sendSuggestedActions(context);
        } else {
            currentIntent = intent;

            await this.previousIntent.set(context, { intentName: intent });
            // conversationData.endDialog = true;
        }

        console.log('currentIntent', currentIntent);

        /// entering to turn answer
        if (currentIntent !== 'None') {
            const dept = 'department';
            const camp = 'campus';
            console.log(currentIntent);
            if (dept === currentIntent) {
                console.log('Inside Make Department Case');
                await this.conversationData.set(context, { endDialog: false });
                await this.departmentDialog.run(context, this.dialogState, entities);
                conversationData.endDialog = await this.departmentDialog.isDialogComplete();
                if (conversationData.endDialog) {
                    await context.sendActivity('Thank you for getting touch');
                    await this.previousIntent.set(context, { intentName: null });
                // await this.sendSuggestedActions(context);
                }
            } else if (camp === currentIntent) {
                console.log('Inside Make Campus Case');
                await this.conversationData.set(context, { endDialog: false });
                await this.campusDialog.run(context, this.dialogState, entities);
                conversationData.endDialog = await this.campusDialog.isDialogComplete();
                if (conversationData.endDialog) {
                    await context.sendActivity('Thank you for getting touch');
                    await this.previousIntent.set(context, { intentName: null });
                    await this.sendSuggestedActions(context);
                }
            }
            // case 'cse':
            //     console.log('Inside Make cse Case');
            //     await this.conversationData.set(context, { endDialog: false });
            //     await this.campusDialog.run(context, this.dialogState);
            //     conversationData.endDialog = await this.campusDialog.isDialogComplete();
            //     if (conversationData.endDialog) {
            //         await context.sendActivity('Thank you for getting touch');
            //         await this.previousIntent.set(context, { intentName: null });
            //         await this.sendSuggestedActions(context);
            //     }

            //     break;

            else {
            // await this.sendActivity('Did not match any query?');
                console.log('Did not match any case');
            }
        }
    }
}

module.exports.NSTU101bot = NSTU101bot;
