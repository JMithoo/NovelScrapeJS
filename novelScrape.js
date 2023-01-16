
// Require Packages
const fs = require('fs');
const stream = require('stream');
const { exec } = require("child_process");

const cheerio = require('cheerio');
const cliProgress = require('cli-progress');

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')


// Argument defaults
var site = "https://www.lightnovelworld.com";
// Example of a valid url that will be used if none given
var novelUrl = 'https://www.lightnovelworld.com/novel/the-villains-side-of-the-novel';
var container = '#chapter-container';
// needed for when too many requests get flagged
var maxRequests = 1000;
var outputFormat = ".azw3";

// Apply any arguments given by yargs
const argv = yargs(hideBin(process.argv)).argv
if (argv.site){
    site=argv.site
}
if (argv.url){
    novelUrl=argv.url
}
if (argv.container){
    container=argv.container
}
if (argv.maxRequests){
    maxRequests=argv.maxRequests
} 
if (argv.outputFormat){
    outputFormat=argv.outputFormat
}


// Declare global variables
var novelTitle = "";
var novelAuthor = "";
var novelChapters = 0;
var chapterURL = "";


/**
 * Splits up an array into chunks of size maxRequests
 * 
 * @param {*} arr The array to segment
 * @returns array containing multiple arrays of size maxRequests or less
 */
async function segmentArray(arr){
    var sArr=[];
    for (let i = 0; i < arr.length; i += maxRequests) {
        let c = arr.slice(i, i + maxRequests);
        sArr.push(c);
    }
    return sArr;
}


/**
 * Creates array containing all chapter URLS
 * NOTE: This fails to capture prologues but allows fast async fetchs for chapters
 * @returns array containing all chapter URLS
 */
async function getChapterLinks(){
    var chapterLinks = [];
    for(let i = 1; i < novelChapters+1; i++){
        chapterLinks.push(chapterURL+i);
    }
    return chapterLinks;
}


/**
 * Uses fetch and cheerio to grab key novel data
 * Including title, author,name, Cover, and chapter data 
 * 
 * @param {*} url URL of Novel
 */
async function getNovelInfo(url){
    // Get Page Contents
    const response = await fetch(url);
    const body = await response.text();

    // Parse contents 
    const $ = cheerio.load(body);

    // Find Cover and novel title
    const i =$('.cover > img').first();
    c = i.attr("data-src");
    novelTitle = i.attr("alt");

    // Find novel author
    const a =$('div.author > a > span').first();
    novelAuthor = a.text();

    // Create output dir 
    if (!fs.existsSync('./out/temp')){
        fs.mkdirSync('./out/temp');
    }
    // Download cover to temp file
    fetch(c).then(response => stream.Readable.fromWeb(response.body).pipe(fs.createWriteStream('./out/temp/i.jpg')));

    // Get number of chapters
    const s = $('.header-stats > span:nth-child(1) > strong').first();
    novelChapters = parseInt(s.text());

    // Get chapter URL without the number of the chapter
    const f = $('#readchapterbtn').first();
    chapterURL = site+f.attr("href").slice(0,-1);
}


/**
 * Grabs the text and title from chapters
 * 
 * 
 * @param {*} chapterContents Array containing chapter contents
 * @param {*} urls URLS to fetch
 * @returns Updated chapterContents array
 */
async function getChapterContents(chapterContents,urls){
    // array containing chapters that couldnt be aquired
    var failedChapters = [];
    // Fetch all pages of URLs and get html content
    await Promise.all(urls.map(url =>
        fetch(url).then(resp => resp.text()).then(text => {
            // Parse html
            const $ = cheerio.load(text);

            var chapterText  = ""
            // Get chapter title
            var chapterTitle = $('.chapter-title').first().text();

            // Get children of chapter container (contains text)
            var c =$(container).first().children();

            // Iterate through all text containers
            for(let i = 0; i < c.length; i++){
                // Only add if it doesnt include an ad
                if (!$(c[i]).html().includes('<dl><dt>')){
                    // Add to string
                    chapterText+="<p>"+($(c[i]).html())+"</p>"; 
                } 
            }
            // Get the number of chapter
            chapNum = url.split("/chapter-")[1];
            // If the text was successfully loaded add to the array at position chap number
            // Else, add the url to failed chapters
            if (chapterText.length==0){
                failedChapters.push(url);
            }else{
                chapterContents[chapNum] = [chapterTitle,chapterText];
            }
        })
    ))
    return chapterContents,failedChapters;
}


/**
 * Builds HTML document using novel data and chapter contents
 * 
 * @param {*} chapters Array containing chapter titles and contents
 * @returns HTML document ready to be converted to ebook
 */
async function buildHTML(chapters){
    // Start of html file with novel specific headings
    htmlContent=`<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
      <meta name="author" content="${novelAuthor}">
      <title>${novelTitle}</title>
    </head>
    <body>`
    // Iterate through chapters and add title and content to the string
    for(let i = 1; i < chapters.length; i++){
        htmlContent+='<h2>'+chapters[i][0]+'</h2>';
        htmlContent+=chapters[i][1];
    }
    // End the HTML document and return
    htmlContent+=`</body></html>`;
    return htmlContent;
}
    

/**
 * Main function to allow for aync functions to run
 */
async function main(){
    console.log("Downloading novel...")
    //Initialise progress bar
    const b1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    await getNovelInfo(novelUrl)

    // Get and split chapter links
    var chapterLinks = await getChapterLinks();
    var chapterLinksSeg = await segmentArray(chapterLinks);
    var chapterContents = new Array(novelChapters);
    
    // Start progress bar
    b1.start(novelChapters, 0);
    // Iterate through urls adding chapters to chapterContents
    // then re-add any failed urls back into the array if there are any
    for (let i = 0; i < chapterLinksSeg.length; i ++) {
        chapterContents,y = await getChapterContents(chapterContents,chapterLinksSeg[i]);
        if (y.length!=0){
            chapterLinksSeg.push(y)
        }
        chapterContents.push;
        // Update progress bar
        b1.increment();
        b1.update(novelChapters-y.length);
    } 
    // Finish Progress bar 
    b1.stop();

    // Build HTML
    console.log("Building HTML...");
    var html = await buildHTML(chapterContents);

    // Write to temp file
    console.log("Writing HTML...");
    await fs.writeFile('./out/temp/t.html', html, (err) => err && console.error(err));

    // Run calibre cli command using nodejs child exec
    var command ='ebook-convert ./out/temp/t.html ./out/"'+novelTitle+'"'+outputFormat+' --cover ./out/temp/i.jpg'
    console.log("Converting HTML to "+outputFormat+" ...")
    var child = exec(command);
    child.on('exit', async function() {
        // Once command has finished delete temp files and exit
        console.log("Cleaning up temp files...");
        fs.rmSync("./out/temp", { recursive: true, force: true });
        console.log("Conversion Complete!");        
      })
}

// Call Main
main();