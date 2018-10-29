/*eslint-env es6*/
const d3 = require('d3-dsv');
const fs = require('fs');
const path = require('path');
const canvas = require('canvas-api-wrapper'); // Moved out of global scope
const flatten = require('flat'); // Moved out of global scope

/*************************************************************************
 * Gets the canvas JSON objects for each course in a specified subaccount
 * @param {object} userInput 
 * @returns {object[]} An array of all the course objects
 *************************************************************************/
async function getAllCourses(userInput) {
    // get all courses from the Master Courses subaccount (i.e. 42)
    let canvasGetRequestOptions = {
        sort: 'course_name',
        'include[]': 'subaccount',
    };

    // add the search term if one was provided by the user
    if (userInput.searchTerm) {
        canvasGetRequestOptions.search_term = userInput.searchTerm; 
    }

    let courses = await canvas.get(`/api/v1/accounts/${userInput.subaccount}/courses?include[]=subaccount&include[]=term`, canvasGetRequestOptions);
    console.log(courses.length);
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
        // Make sure courses isn't undefined after the filter
        courses = courses ? courses : []; 
    }
    // if the user specified a specific term, filter through and only include those in that term
    if (userInput.term !== 'All Terms') {
        courses = courses.filter(course => course.term.name.includes(userInput.term));
        // Make sure courses isn't undefined after the filter
        courses = courses ? courses : []; 
    }
    // Delete any keys that we dont want, to preemptively clear up memory.
    courses = courses.map( (course) => {
        let courseKeysToKeep = ['course_code', 'name', 'id', /* 'term', */ 'account_id'];
        Object.keys(course).forEach( courseKey => {
            let doKeepKey = courseKeysToKeep.some( keyToKeep => keyToKeep === courseKey);
            if (!doKeepKey) delete course[courseKey];
        } );
        /* let termKeyToKeep = ['name'];
        Object.keys(course.term).forEach( termKey => {
            let doKeepKey = termKeyToKeep.some(keyToKeep => keyToKeep === termKey);
            if (!doKeepKey) delete course.term[termKey];
        }); */
        return course;
    });
    // console.log(courses[0]);
    console.log(`\nYou have found ${courses.length} courses!\n`);
    return courses;
}

/*************************************************************************
 * Gets all the JSON canvas items to look through
 * @param {object} course The specific course object to look at
 * @returns {object[]} An array of all the canvas items to look through
 *************************************************************************/
async function getCanvasItems(course) {
    // Build the canvas-api-wrapper course and get all the needed items
    let canvasCourse = canvas.getCourse(course.id);
    
    // Put all of the items into a single array
    let items = [];
    items = items.concat(...await canvasCourse['assignments'].get({ 'include[]': 'external_tool_tag_attributes'}));
    items = items.concat(...await canvasCourse['pages'].getComplete());
    items = items.concat(...await canvasCourse['quizzes'].getComplete());
    items = items.concat(...await canvasCourse['modules'].getComplete());
    items = items.concat(...await canvasCourse['discussions'].get());
    items = items.concat(canvasCourse.quizzes.getFlattened());
    items = items.concat(canvasCourse.modules.getFlattened());

    return items;
}

/***************************************************************
 * Creates the object that the d3-csv will format.
 * It is crated based on information gathered from:
 * course, canvasItems, and user input
 * @param {object} course 
 * @param {object} userInput 
 * @param {object} matchFound
 * @returns {object} A log item that will go into the csv report 
 ***************************************************************/
function createCanvasItemLog(course, userInput, matchFound) {
    return Object.assign({},
        {
            'Course Term': course.term.name,
            'Course Code': course.course_code,
            'Course Name': course.name,
            'Course ID': course.id,
            'Canvas Item Type': matchFound.canvasItem.constructor.name,
            'Canvas Item Title': matchFound.canvasItem.getTitle(),
            'Canvas Item ID': matchFound.canvasItem.getId(),
            'Canvas Item Internal Link': matchFound.canvasItem.html_url, // ? matchFound.canvasItem.html_url : 'null',
            'Canvas Item External Link': matchFound.itemFound.objValue, // ? matchFound.itemFound.objValue : 'null',
            'Link Searched For': userInput.locateUrl,
            'Messages': JSON.stringify(matchFound.message)
        });
}

/** ***********************************************************************************
 * Search the given canvas item to see if it has a matching url. 
 * If so, return that object. else return false.
 * @param {object} canvasItem the specific canvas item to search through
 * @param {object} userInput the letiables that the user selected
 * @returns {object[]} An array of all the canvas items that had the searched-for url
 * ************************************************************************************/
function findUrlMatch (canvasItem, userInput) {
    let message = null;
    let flattenedItem = flatten(canvasItem); // make the canvasItem object a flat object

    /* Check if the searched for url is in the canvasItem object, or if 
       any of the urls in the canvasItem object are in the searched for url */
    let objKeys = Object.keys(flattenedItem);
    let objValues = Object.values(flattenedItem);

    // check if the canvasItem flattened object has the search phrase in it
    let itemsFound = objValues.reduce((acc, objValue, i) => {
        if (objValue && objValue.toString().includes(userInput.locateUrl)) {
            return acc.concat({
                objKey: objKeys[i],
                objValue
            });
        }
        return acc;
    }, []);

    // print out a message, depending on how many instances of the search phrase were found
    if (itemsFound === undefined) {
        return;
    } else if (itemsFound.length > 1) {
        message = `${itemsFound.length} instances of ${userInput.locateUrl} found on this Canvas Item\n`;
    }

    // create the return object with more information
    itemsFound = itemsFound.map(itemFound => {
        return {
            itemFound,
            message,
            canvasItem
        };
    });
    return itemsFound;
}

/** **********************************************************************************
 * Check each course to see if the searched for url is found within it,
 * then return information on the items to log that will go into the csv 
 * @param {object} course
 * @param {object} canvasItems
 * @param {object} userInput
 * @returns {object[]} An array of logs for a course that will go into the csv report
 * ***********************************************************************************/
function checkCourse(course, canvasItems, userInput, courseIndex, courseCount) {
    console.log(`${courseIndex.toString().padStart(5, '0')} / ${courseCount.toString().padStart(5, '0')} Searching through ${course.name}`);
    let matchesFound = canvasItems.reduce((acc, canvasItem) => {
        let itemsFound = findUrlMatch(canvasItem, userInput);
        if (itemsFound !== undefined) {
            return acc.concat(...itemsFound);
        }
        return acc;
    }, []);
    if (matchesFound.length === 0) return [];
    return matchesFound.map(matchFound => createCanvasItemLog(course, userInput, matchFound));
}

/** ***********************************************************************
 * Get all the user-specified courses, then find where the search url is found
 * within each course and stick that information into a CSV for further analysis
 * @param {object} userInput object including all user input from cli.js
 * ************************************************************************/
async function main(userInput) {
    let logs = [];
    const courses = await getAllCourses(userInput); // get the courses

    /* For each course:
        - get it's canvas items and put them in a flat array of all canvas items
        - for each canvas item search it's canvas JSON object for the matched search url
        - stick the canvas item's information into a log if it had the search url somewhere
        - return all the log objects and assign them to the 'logs' array */
    await Promise.all(await courses.map(async (course, courseIndex) => checkCourse(course, await getCanvasItems(course), userInput, courseIndex, courses.length))).then((allMatches) => logs = logs.concat(...allMatches)).catch((err) => {});
    
    // Format and create the CSV file with the log data
    const csvData = d3.csvFormat(logs, [
        'Course Term',
        'Course Code',
        'Course Name',
        'Course ID',
        'Canvas Item Type',
        'Canvas Item Title',
        'Canvas Item ID',
        'Canvas Item Internal Link',
        'Canvas Item External Link',
        'Link Searched For',
        'Messages'
    ]);

    // if the specified path doesn't exist, make it
    console.log('Formatted csv', csvData);
    if (!fs.existsSync(path.resolve(userInput.saveDirectory))) {
        fs.mkdirSync(path.resolve(userInput.saveDirectory));
    }

    // write it all to a file
    console.log('Writing File');
    const date = new Date();
    const filename = `changeLog-${date.toDateString().replace(/:/, '')} ${date.getHours()}h${date.getMinutes()}m${date.getSeconds()}s.csv`;
    fs.writeFileSync(path.resolve(userInput.saveDirectory, filename), csvData);
}

module.exports = {
    main
};