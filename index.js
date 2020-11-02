const fs = require('fs')
const request = require('request');
const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: true })

runPreDownload(items => {
    //runDownloadLoop(items.slice(3000, Math.min(items.length, 4000)))
    runDownloadLoop(items)
}) 

function runPreDownload(cb){
    nightmare
        .goto('https://results.cec.gov.ge/#/ka-ge/election_43/prot')
        .wait(3000)
        .evaluate((selector) => {
            const itemElems = document.querySelectorAll(selector)
            var arr = []
            var names = new Set()
            
            itemElems.forEach(itemElem => {
                var category = itemElem.parentElement.parentElement.parentElement.children[0].innerText.trim()
                var title = itemElem.querySelector('.item-text').innerHTML
                if(!names.has(title)){
                    names.add(title)
                }
                else{
                    category += '-1'
                }

                arr.push({ 
                    pageUrl: itemElem.href,
                    itemCode: itemElem.href.substr(itemElem.href.lastIndexOf('/') + 1),
                    title: title,
                    category: category
                })
            });
            return arr
        }, 'a.item-box')
        .then(items => {
            //console.log(items)
            fs.writeFileSync('items.json', JSON.stringify(items))
            //cb(items)
        })
        .catch(error => {
            console.error('Search failed:', error)
        })
}

function runDownloadLoop(items){
    openPageAndDownloadImage(items, 0)
}

function openPageAndDownloadImage(items, index){
    if(index >= items.length){
        nightmare.end();
        return;
    }

    var item = items[index]
    nightmare
        .goto(item.pageUrl)
        .wait('img.prot-img')
        .evaluate(selector => {
            return document.querySelector(selector).src
        }, 'img.prot-img')
        .then(imageUrl => {
            if(!fs.existsSync('images-new/' + item.category)){
                fs.mkdirSync('images-new/' + item.category)
            }
            const saveAs = 'images-new/' + item.category + '/' + item.title + '.jpg'
            download(imageUrl, saveAs, () => {
                console.log('result: ', item)
                openPageAndDownloadImage(items, index+1)
            })
        })
}

function download(url, dest, cb){
    const file = fs.createWriteStream(dest);
    const sendReq = request.get(url);

    // verify response code
    sendReq.on('response', (response) => {
        if (response.statusCode !== 200) {
            return cb('Response status was ' + response.statusCode);
        }
        sendReq.pipe(file);
    });

    // close() is async, call cb after close completes
    file.on('finish', () => file.close(cb));

    // check for request errors
    sendReq.on('error', (err) => {
        fs.unlink(dest);
        return cb(err.message);
    })

    file.on('error', (err) => { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        return cb(err.message);
    })
}