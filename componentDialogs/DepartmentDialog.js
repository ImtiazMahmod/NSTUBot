// const { MessageFactory } = require('botbuilder');
const { WaterfallDialog, ComponentDialog } = require('botbuilder-dialogs');

const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');

const { CardFactory } = require('botbuilder');
const { QnAMaker } = require('botbuilder-ai');

const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var endDialog = '';

class DepartmentDialog extends ComponentDialog {
    constructor(conservsationState, userState) {
        super('makeReservationDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT, this.noOfParticipantsValidator));
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this), // Ask confirmation if user wants to make reservation?
            this.getName.bind(this), // Get name from user
            // this.getNumberOfParticipants.bind(this), // Number of participants for reservation
            // this.getDate.bind(this), // Date of reservation
            // this.getTime.bind(this), // Time of reservation
            // this.confirmStep.bind(this), // Show summary of values entered by user and ask confirmation to make reservation
            this.finalStep.bind(this)

        ]));

        this.initialDialogId = WATERFALL_DIALOG;

        // dispatch with qna maker
        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        this.qnaMaker = qnaMaker;
    }

    async run(turnContext, accessor, entities) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        console.log('entities', entities);
        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id, entities);
        }
    }

    async firstStep(step) {
        endDialog = false;
        // Running a prompt here means the next WaterfallStep will be run when the users response is received.
        return await step.prompt(CONFIRM_PROMPT, 'Would you like to know about department?', ['yes', 'no']);
    }

    // async sendSuggestedActions(turnContext) {
    //     var reply = MessageFactory.suggestedActions(['Campus', 'Department', 'Admission'], 'What would you like to know today ?');
    //     await turnContext.sendActivity(reply);
    // }

    async getName(step) {
        console.log(step.result);
        if (step.result === true) {
            return await step.prompt(TEXT_PROMPT, 'In which department you would like to know?');
        }
        if (step.result === false) {
            await step.context.sendActivity('You dont choose to know about department');
            endDialog = true;
            return await step.endDialog();
        }
    }

    // async getNumberOfParticipants(step) {
    //     step.values.name = step.result;
    //     return await step.prompt(NUMBER_PROMPT, 'How many participants ( 1 - 150)?');
    // }

    // async getDate(step) {
    //     step.values.noOfParticipants = step.result;

    //     return await step.prompt(DATETIME_PROMPT, 'On which date you want to make the reservation?');
    // }

    // async getTime(step) {
    //     step.values.date = step.result;

    //     return await step.prompt(DATETIME_PROMPT, 'At what time?');
    // }

    // async confirmStep(step) {
    //     step.values.time = step.result;

    //     var msg = ` You have entered following values: \n Name: ${ step.values.name }\n Participants: ${ step.values.noOfParticipants }\n Date: ${ JSON.stringify(step.values.date) }\n Time: ${ JSON.stringify(step.values.time) }`;

    //     await step.context.sendActivity(msg);

    //     return await step.prompt(CONFIRM_PROMPT, 'Are you sure that all values are correct and you want to make the reservation?', ['yes', 'no']);
    // }

    async finalStep(step) {
        // if (step.context.activity.text.toLowerCase() === 'ice') {
        //     await step.context.sendActivity('Go to Official Site: https://nstu.edu.bd/department/ice/');
        // }
        var result = await this.qnaMaker.getAnswers(step.context);
        const qnaData = result[0].answer.split(';');

        console.log(qnaData);
        const title = qnaData[0];
        const description = qnaData[1];
        const imageUrl = qnaData[2];
        const linkTitle = qnaData[3];
        const url = qnaData[4];

        await step.context.sendActivity(
            // `${result[0].answer}`

            // title, description,imageUrl, linkTitle, imgUrl
            {
                attachments: [CardFactory.heroCard(title, description, CardFactory.images([imageUrl]),
                    CardFactory.actions([
                        {
                            type: 'openUrl',
                            title: linkTitle,
                            value: url
                        }
                    ]))]
            // //     //     CardFactory.heroCard('Lorem Ipsum 2', 'https://mysite/myimg.jpg', ['action1', 'action2'])],
            // //     // attachmentLayout: 'carousel',
            // //     // text: 'asd'
            }
        );
        // await this.sendSuggestedActions(context);
        console.log(result);
        endDialog = true;
        return await step.endDialog();
        // if (step.result === true) {
        //     // Business

        //     await step.context.sendActivity('Reservation successfully made. Your reservation id is : 12345678');
        //     endDialog = true;
        //     return await step.endDialog();
        // }
    }

    async noOfParticipantsValidator(promptContext) {
    // This condition is our validation rule. You can also change the value at this point.
        return promptContext.recognized.succeeded && promptContext.recognized.value > 1 && promptContext.recognized.value < 150;
    }

    async isDialogComplete() {
        return endDialog;
    }
}

module.exports.DepartmentDialog = DepartmentDialog;
