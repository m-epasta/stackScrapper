# STACKSCRAPPER - Stackoverflow scrapper 

VS Code extension that automatically searches Stack Overflow for error solutions and displays them in Smart Help.

## Features

- Automatic error detection from problems panel
- Quick search using code actions (Ctrl+Shift+);
- Code actions via lightbulb menu
- Smart query generation with error + code context
- Stack Overflow results in VS Code panel

## Usage

1. Get an error in your code
2. Click the lightbulb or press Ctrl+Shift+;
3. Select "Search Error on Stack Overflow"
4. View solutions in the Error Help panel

## Configuration

See extension settings to customize search behavior.

``` json
    "stackScrapper.apiKey": "r8_VXXKD53A", // you can set your stackoverflow API key — you can have a great uise without it and sometimes even better results
    "stackScrapper.maxResults": 8, // here, you can set the maximum results you want to see — the max is 15, also notice that more the value is high less requests you'll be able to send (without API key)
    "stackScrapper.searchTimeout": 10000, // the maximum search time — reccommend between 10 to 15 seconds(10000 to 15000 in milliseconds) because the scrapper is lightweight so the real only barrier is your connection or a internal error of the extension.
    "stackScrapper.autoDetectErrors": true // for now not implemented yet
    "stackScrapper.filterByAccepted": true // search only for accepted results (answered one) — reccommend to use if your actual results are bad
    "stackScrapper.includeCodeContext": false // include code context — DO NOT reccommend in most use cases: useful only when the problem is "general" but it will mainly get you bad results
    "stackScrapper.minScore": 1 // require a minimum score on stack overflow — useful only when your resluts are bad or out of context. Personnally, i set it to 2 to avoid bad results (negative score)
    "stackScrapper.site": "stackoverflow", // honestly, it really seems to be useless: maybe i gonna add a way to search on multiple websites
    "stackScrapper.stackOverflowSearchUrl": "https://api.stackexchange.com/2.3/search/advanced" // for enhanced and precise wants in term of results — the default API link is the one presented in the example, so if you dont want to change it you can remove it
    



```
