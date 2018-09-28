/*eslint-env es6*/
const canvas = require('canvas-api-wrapper');
const d3 = require('d3-dsv');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/*************************************************************************
 * Gets a JSON of all the courses in the given subaccount
 * @param {object} userInput 
 *************************************************************************/
async function getAllCourses(userInput) {
    // get all courses from the Master Courses subaccount (i.e. 42)
    var canvasGetRequestOptions = {
        sort: 'course_name',
        'include[]': 'subaccount',
        search_term: 'seth childers'
    };
    let courses = await canvas.get(`/api/v1/accounts/${userInput.subaccount}/courses?include[]=subaccount&include[]=term`, canvasGetRequestOptions);
    // sort them alphabetically so I know where in the list the tool is at when running
    courses.sort((a, b) => {
        if (a.course_code > b.course_code) return 1;
        else if (a.course_code < b.course_code) return -1;
        else return 0;
    });
    // although we got everything under the specified account, not
    // everything necessarily belongs to it since there are nested subaccounts
    if (userInput.includeNestedAccounts === true) {
        courses = courses.filter(course => course.account_id === userInput.subaccount);
    }
    // if the user specified a specific term, filter through and only include those in that term
    if (userInput.term !== 'All Terms') {
        courses = courses.filter(course => course.term.name.includes(userInput.term));
    }
    console.log(`\nYou have found ${courses.length} courses!\n`);
    return courses;
}

/*************************************************************************
 * makes a get request to canvas to get all of the data in the given topic
 * for the given course
 * @param {object} course the specific course object to look at
 * @param {object} userInput the userInput object that has the wanted category
 *************************************************************************/
async function getCanvasItems(course, userInput) {
    let canvasItems = await canvas.get(`/api/v1/courses/${course.id}/${userInput.category}`);
    console.log(`Got ${userInput.category} for ${course.name}`);
    return canvasItems;
}

/*************************************************************************
 * Search the given canvas item to see if it has a matching url. 
 * If so, return that object. else return false.
 * @param {object} course here only to match signature of fixCanvasItems
 * @param {object} canvasItem the specific canvas item to search through
 * @param {object} userInput the variables that the user selected
 *************************************************************************/
function findUrlMatch (course, canvasItem, userInput, messages) {
    // Core Logic
    var itemFound = Object.values(canvasItem).find((objValue) => {
        if (typeof objValue === 'object' && objValue !== null && objValue.url !== undefined) 
            return userInput.locateUrl.includes(objValue.url); 
    });
    itemFound = itemFound ? itemFound : [];
    // Console loggy stuff
    if (itemFound.length === 0) console.log(`No matches found. Moving to the next ${userInput.category.slice(0, -1)}...`);
    else if (itemFound.length > 1) console.log(`More than one ${userInput.locateUrl} found`);
    else console.log('found one!');
    //TODO we might need to move some things
    // Stuff we care about
    if (itemFound.length === 0) return false;
    else if (itemFound.length > 1) messages.push(`More than one ${userInput.locateUrl} found`);
    return itemFound;
}

/*************************************************************************
 * Creates the object that the d3-csv will format.
 * It is crated based on information gathered from:
 * course, canvasItems, and user input
 *************************************************************************/
function createCanvasItemLog(term, courseName, courseId, type, itemTitle, link, messages) {
    return {
        'Term': term,
        'Course Name': courseName,
        'Course ID': courseId,
        'Type': type,
        'Item Title': itemTitle,
        'Link Searched For': link,
        'Messages': JSON.stringify(messages)
    };
}

/*************************************************************************
 * Words
 * @param {object} course
 * @param {object} canvasItems
 * @param {object} userInput
 *************************************************************************/
function fixCanvasItems(course, canvasItems, userInput) {
    console.log(`Fixing ${userInput.category}`);
    var messages = [];
    var matchesFound = canvasItems.filter(canvasItem => findUrlMatch(course, canvasItem, userInput, messages));
    console.log(); // new line for formatting
    if (!matchesFound  || matchesFound === 0) return [];
    let possibleTitleNames = ['title', 'name', 'display_name', 'question_name'];
    let title = matchFound => possibleTitleNames.reduce((acc, possibleTitleName) => acc = matchFound[possibleTitleName] !== undefined ? matchFound[possibleTitleName] : acc, '');
    var canvasItemLog = matchesFound.map(matchFound => createCanvasItemLog(course.term.name, course.name, course.id, userInput.category, title(matchFound), userInput.locateUrl, messages));
    return canvasItemLog;
}



/*************************************************************************
 * Words
 * @param {object} userInput object including domain, subaccount, includeNestedAccounts, 
 *************************************************************************/
async function main(userInput) {
    let logs = [];
    let courses = await getAllCourses(userInput); // get all the courses
    var allMatchesInCourses;
    await Promise.all( courses.map(async course => fixCanvasItems( course, await getCanvasItems(course, userInput), userInput )) ).then((allMatches) => allMatchesInCourses = allMatches ); // search the category for each course
    logs = logs.concat(...allMatchesInCourses);
    console.log('LOGS: ', logs);
    console.log('Formating csv');
    /* Format and create the CSV file with the log data */
    const csvData = d3.csvFormat(logs, [
        'Term',
        'Course Name',
        'Course ID',
        'Type',
        'Item Title',
        'Link Searched For',
        'Messages'
    ]);
    console.log(csvData);
    // if the specified path doesn't exist, make it
    if (!fs.existsSync(path.resolve(userInput.saveDirectory))) {
        fs.mkdirSync(path.resolve(userInput.saveDirectory));
    }
    // write it all to a file
    console.log('Writing File');
    fs.writeFileSync(path.resolve(userInput.saveDirectory, 'changeLog.csv'), csvData);
}

module.exports = {
    main
};