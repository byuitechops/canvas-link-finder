const // Require Libraries
    fs = require('fs'), // Node
    path = require('path'), // Node
    d3 = require('d3-dsv'), // NPM
    canvas = require('canvas-api-wrapper'); // NPM

async function getAllCourses(userInput) {
    let courses = await canvas.get('/api/v1/accounts/1/courses?include[]=subaccount&include[]=term');
    // Delete any keys that we dont want, to preemptively clear up memory.
    courses = courses.map((course) => {
        let courseKeysToKeep = ['course_code', 'name', 'id', 'account_id'];
        Object.keys(course).forEach(courseKey => {
            let doKeepKey = courseKeysToKeep.some(keyToKeep => keyToKeep === courseKey);
            if (!doKeepKey) delete course[courseKey];
        });
        return course;
    });
    console.log(`\nYou have found ${courses.length} courses!\n`);
    return courses;
}
    
async function main () {
    const outputLocation = './splitCourses/all-courses.csv';
    fs.writeFileSync(path.resolve(outputLocation), d3.csvFormat(await getAllCourses()));
}

main();