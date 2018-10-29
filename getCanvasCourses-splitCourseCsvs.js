const // Require Libraries
    fs = require('fs'), // Node
    path = require('path'), // Node
    d3 = require('d3-dsv'); // NPM
    
async function main() {
    let parsedCsv = d3.csvParse( fs.readFileSync(path.resolve('./splitCourses/allCourses.csv'), 'utf8') );
    let numOfCoursesPerCsv = 1000;
    let counter = 0;
    for (let i = 0; i <= parsedCsv.length; i += numOfCoursesPerCsv ) {
        // Count Stuff
        ++counter;
        let startSlice = i;
        let endSlice = i + numOfCoursesPerCsv - 1;
        if (endSlice > parsedCsv.length) endSlice = parsedCsv.length-1;
        // Slice Stuff
        let slicedCsv = parsedCsv.slice(startSlice, endSlice);
        // Name Stuff
        let startDigitPadding = startSlice.toString().padStart(5, '0');
        let endDigitPadding = endSlice.toString().padStart(5, '0');
        let filename = `${counter.toString().padStart(3, '0')}_allCourses_${startDigitPadding}-${endDigitPadding}`;
        // Write Stuff
        fs.writeFileSync( path.join('./splitCourses/', filename), d3.csvFormat(slicedCsv) );
    }
}

main();