const canvas = require('canvas-api-wrapper');
const d3 = require('d3-dsv')
const fs = require('fs');
const path = require('path');

async function getCanvasItems(course, userInput) {
    let canvasItems = await canvas.get(`/api/v1/courses/${course.id}/${userInput.category}`, {
        'include[]': 'external_tool_tag_attributes'
    });
    console.log(`Got ${userInput.category} for ${course.name}`);
    return canvasItems;
}
async function fixCanvasItems(course, canvasItems, userInput) {
    console.log(`Fixing ${userInput.category}`);

    // find the old url
    let found = canvasItems.filter(canvasItem => {
        let objValues = Object.values(canvasItem);
        let objString = objValues.join(' ');
        console.log(objString);
        return objString.includes(userInput.locateUrl);
    });

    console.log(`found: ${found}`);
    if (found.length === 0) {
        return;
    }


    // catch the errors
    let messages = [];
    if (found.length > 1) {
        messages.push(`More than one ${userInput.locateUrl} found`);
        console.error(`More than one ${userInput.locateUrl} found`);
    }

    // get the logs for the csv
    let canvasItemLogs = found.map(foundItem => {
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

        // return the log for the csv
        return {
            'Course Name': course.name,
            'Course ID': course.id,
            'Item Title': title,
            'Link Searched For': userInput.locateUrl,
            'Found': foundItem,
            'Messages': JSON.stringify(messages)
        }
    });

    return canvasItemLogs;
}

async function getAllCourses(userInput) {
    // get all courses from the Master Courses subaccount (i.e. 42)
    let courses = await canvas.get(`/api/v1/accounts/${userInput.subaccount}/courses`, {
        sort: 'course_name',
        'include[]': 'subaccount',
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
        courses = courses.filter(course => course.account_id === userInput.subaccount)
    }
    return courses;
}

async function main(userInput) {
    // get all the courses
    let courses = await getAllCourses(userInput);
    // get the assignments for each course
    let logs = [];
    for (let i = 0; i < courses.length; i++) {
        let canvasItems = await getCanvasItems(courses[i], userInput);
        let logItem = await fixCanvasItems(courses[i], canvasItems, userInput);
        logs = logs.concat(logItem);

    }
    console.log('Formating csv');
    /* Format and create the CSV file with the log data */
    const csvData = d3.csvFormat(logs, [
        "Course Name",
        "Course ID",
        "Item Title",
        "Link Searched For",
        "Found",
        "Messages"
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
}