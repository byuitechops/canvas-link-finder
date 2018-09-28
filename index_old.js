/*eslint-env es6 */
const canvas = require('canvas-api-wrapper');
// canvas.oncall = e => console.log(e.method, e.url);
const d3 = require('d3-dsv');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

async function getCanvasItems(course, userInput) {
    let canvasItems = await canvas.get(`/api/v1/courses/${course.id}/${userInput.category}`);
    console.log(`Got ${userInput.category} for ${course.name}`);
    // console.log('Canvas Items: ', Object.values(canvasItems.join(' ')));
    return canvasItems;
}

let counter = 0;
async function fixCanvasItems(course, canvasItems, userInput) {
    console.log(`Fixing ${userInput.category}`);
    // fs.writeFileSync(`./theThingWeNeed_${counter++}.json`, JSON.stringify(canvasItems, null, 4));//***********************************************
    // find the old url
    let found = canvasItems.filter(canvasItem => {
        counter ++;
        // if (counter === 10) fs.writeFileSync('./theThingWeNeed_O.json', JSON.stringify(Object.values(canvasItem), null, 4)); //***********************************************
        let objValues = Object.values(canvasItem);
        // console.log(objValues);
        let objString = objValues.join(' ');
        // console.log(chalk.blue(objString));
        var urlExists = objValues.find((objValue) => {
            // console.log(objValue);
            if (typeof objValue === 'object') {
                try {return userInput.locateUrl.includes(objValue.url);}
                catch (e) {return false;}
                return false;
            }

        });
        return urlExists;
    });
    console.log(found);

    // console.log(`found: ${found}`);
    console.log('Found length: ', found.length);
    if (found.length === 0) {
        console.log('No matches found. Moving to the next course...\n');
        return;
    }

    // catch the errors
    let messages = [];
    if (found.length > 1) {
        messages.push(`More than one ${userInput.locateUrl} found`);
        console.error(`More than one ${userInput.locateUrl} found`);
    }

    // get the logs for the csv
    let canvasItemLogs = found.map(async foundItem => {
        // determine the title based on the canvasItem type
        let title = '';
        if (foundItem.title !== undefined) {
            title = foundItem.title;
        } else if (foundItem.name !== undefined) {
            title = foundItem.name;
        } else if (foundItem.display_name !== undefined) {
            title = foundItem.display_name;
        } else if (foundItem.question_name !== undefined) {
            title = foundItem.question_name;
        }
        console.log('Title is',title);

        // return the log for the csv
        // console.log('I AM READY TO RETURN. BEAM ME UP SCOTTY!');
        return Promise.resolve({
            'Term': course.term.name,
            'Course Name': course.name,
            'Course ID': course.id,
            'Type': userInput.category,
            'Item Title': title,
            'Link Searched For': userInput.locateUrl,
            'Messages': JSON.stringify(messages)
        });
    });

    return Promise.all(canvasItemLogs);
}

async function getAllCourses(userInput) {
    // get all courses from the Master Courses subaccount (i.e. 42)
    let courses = await canvas.get(`/api/v1/accounts/${userInput.subaccount}/courses?include[]=subaccount&include[]=term`, {
        sort: 'course_name',
        'include': [
            'subaccount',
            'term'
        ],
        search_term: 'seth childers'
    });
    
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
        // fs.writeFileSync('./theThingWeNeed.json', JSON.stringify(courses, null, 4)); // ******************************************************************************
        courses = courses.filter(course => course.term.name.includes(userInput.term));
    }
    return courses;
}

async function main(userInput) {
    // get all the courses
    let courses = await getAllCourses(userInput);
    console.log(`\nYou are about to process/check ${courses.length} courses!\n`);
    // get the assignments for each course
    let logs = [];
    for (let i = 0; i < courses.length; i++) {
        try {
            let canvasItems = await getCanvasItems(courses[i], userInput);
            if (canvasItems && canvasItems.length !== 0) {
                await fixCanvasItems(courses[i], canvasItems, userInput)
                    .then((itemsToLog) => { if (itemsToLog && itemsToLog.length !== 0) logs.push(...itemsToLog); }); // changed to push rather than concat. solved some problems but might need some tweaking on larger datasets
            }
        } catch (err) {
            console.error(err);
        }
    }
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