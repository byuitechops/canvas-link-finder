var prompt = require('prompt');
var linkReplace = require('./index_old.js');

/**
 * The function with all the prompt inputs and validation
 */
function getInput() {
    return new Promise((resolve, reject) => {
        // prompt to receive the filepath to the list of courses to run the backup on
        var schema = {
            properties: {
                domain: {
                    type: 'string',
                    description: 'Canvas Domain <byui|byui.test>',
                    pattern: /byui|byui\.test/,
                    message: '<byui|byui.test>',
                    required: true,
                    default: 'byui'
                },
                subaccount: {
                    type: 'number',
                    description: 'The subaccount number you\'d like to run this on',
                    required: true,
                    default: '8'
                },
                includeNestedAccounts: {
                    type: 'boolean',
                    description: 'Would you like to run it on all the accounts under that number?',
                    required: true,
                    default: false
                },
                saveDirectory: {
                    type: 'string',
                    description: 'Where would you like to store the report? (i.e. ../reports)',
                    required: true,
                    default: './reports'
                },
                category: {
                    type: 'string',
                    description: 'What Canvas item category would you like to look through? <assignments|discussions|files|modules|moduleItems|pages|quizzes|quizQuestions>',
                    pattern: /assignments|discussions|files|modules|moduleItems|pages|quizzes|quizQuestions/,
                    message: '<assignments|discussions|files|modules|moduleItems|pages|quizzes|quizQuestions>',
                    require: true,
                    default: 'assignments'
                },
                locateUrl: {
                    type: 'string',
                    description: 'What is the url you are looking for?',
                    require: true,
                    default: 'https://byui-canvas.mapleta.com:443/byui-canvas/lti/'
                },
                term: {
                    type: 'string',
                    description: 'Which term would you like to run this on? <All Terms|Default Term|Master Courses|Fall 2018|Summer 2018|Spring 2018|Winter 2018|Winter2019|>',
                    pattern: /All Terms|Default Term|Master Courses|Fall 2018|Summer 2018|Spring 2018|Winter 2018|Winter2019|/,
                    message: '<All Terms|Default Term|Master Courses|Fall 2018|Summer 2018|Spring 2018|Winter 2018|Winter2019|>',
                    required: true,
                    default: 'All Terms'
                },
            }
        };

        prompt.message = '';

        prompt.start();

        prompt.get(schema, (err, userInput) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            resolve(userInput);
        });
    });
}

async function run() {
    var userInput = await getInput();
    linkReplace.main(userInput);
}

run();