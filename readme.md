## Requirements:
see package.json

NodeJS => 18.13.0 (for fetch etc)

Calibre (In order to convert HTML to Ebook)


## USAGE
eg: node novelScrape.js --url="https://www.lightnovelworld.com/novel/everyone-else-is-a-returnee-29121046"

Arguments:

--site          Url of website eg:                                             --site="https://www.lightnovelworld.com"

--novelUrl      Url of novel eg:                                               --novelUrl="https://www.lightnovelworld.com/novel/everyone-else-is-a-returnee-29121046"

--container     Container containing chapter contents eg:                      --container="#chapter-container"

--maxRequests   Useful where too many requests crashes website or bans you eg: --maxRequests="10"

--outputFormat  Output format of ebook eg:                                     --outputFormat=".azw3"
