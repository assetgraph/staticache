var app = require('express')(),
    AssetGraph = require('assetgraph'),
    Path = require('path'),
    root = process.cwd(),
    mime = require('mime'),
    memoizeAsync = require('memoizeasync'),
    passError = require('passerror'),
    async = require('async'),
    assetGraph = new AssetGraph({root: root + '/'});

console.log("root = " + assetGraph.root);

function sendAsset(asset, req, res, next) {
    var md5Param = req.param('md5');
    if (md5Param === asset.md5Hex) {
        res.setHeader('Cache-Control', 'max-age=99999999');
    } else {
        res.setHeader('Cache-Control', 'max-age=0; must-revalidate');
    }
    res.setHeader('Content-Type', mime.types[asset.extension.substr(1) || 'application/octet-stream']);
    res.send(asset.rawSrc);
}

['warn', 'error', 'info'].forEach(function (eventName) {
    assetGraph.on(eventName, function (obj) {
        console.log(eventName, obj);
    });
});

['addAsset', 'removeAsset', 'addRelation', 'removeRelation'].forEach(function (eventName) {
    assetGraph.on(eventName, function (obj) {
        console.log(eventName, obj.href || obj.url);
    });
});

var isWatchedByDirName = {};

var getPopulatedAsset = memoizeAsync(function (rootRelativeUrl, cb) {
    var url = assetGraph.root + rootRelativeUrl.replace(/^\//, '');
    var asset = assetGraph.findAssets({url: url})[0];
    if (asset) {
        assetGraph
            .populate({startAssets: {id: asset.id}, followRelations: {from: {url: url}}})
            .run(function () {
                cb(null, asset);
            });
    } else {
        assetGraph
            .loadAssets({url: url})
            .run(function (err) {
                var asset = assetGraph.findAssets({url: url})[0],
                    path = rootRelativeUrl;

                if (/\/$/.test(path)) {
                    path += 'index.html';
                }

                // Trim the leading slash if it exists
                path = path[0] === '/' ? path.substr(1) : path;

                var rootRelativePath = decodeURIComponent(path),
                    fileName = Path.resolve(assetGraph.root.replace(/^file:\/\//, ''), rootRelativePath),
                    dirName = Path.dirname(fileName);
                if (!isWatchedByDirName[dirName]) {
                    isWatchedByDirName[dirName] = true;

console.log("WATCHING", dirName)
                    require('fs').watch(dirName, function (eventName, fileName) {
console.log(eventName, fileName);

                        fileName = Path.resolve(dirName, fileName); // Absolutify fileName
                        var changedUrl = 'file://' + fileName.split('/').map(encodeURIComponent).join('/');
                        console.warn('fs.watch: ' + eventName + ' ' + fileName);
                        async.each(assetGraph.findAssets({
                            url: function (url) {
                                return url.replace(/[\?#].*$/, '') === changedUrl;
                            }
                        }), function (asset, cb) {
                            require('fs').readFile(fileName, passError(cb, function (newRawSrc) {
console.log('incomingRelations before', asset.incomingRelations.length)
                                asset.rawSrc = newRawSrc;
console.log('incomingRelations afte', asset.incomingRelations.length)
console.log('new md5');
console.log("POPULATE", asset.url, asset.md5Hex);
                                assetGraph.populate({
                                    startAssets: {id: asset.id}
                                }).run(passError(cb, function () {
                                    (function updateHrefOfIncomingRelations(asset) {
console.log('update', asset.urlOrDescription)
                                        asset.incomingRelations.forEach(function (incomingRelation) {
                                            incomingRelation.href = incomingRelation.href.replace(/\?.*$/, '') + '?md5=' + asset.md5Hex;
                                            updateHrefOfIncomingRelations(incomingRelation.from);
                                        });
                                    }(asset));
                                    cb();
                                }));
                            }));
                        }, function (err) {
                            // Now it'd be cool if the browser reloaded itself
                            if (err) throw err;
                        });
                    });

                }

                if (!asset) {
                    return cb(new Error('Asset not found: ' + url));
                }
                assetGraph
                    .populate({startAssets: {id: asset.id}, followRelations: {from: asset, to: {url: /^file:/}}})
                    .run(function (err) {
                        var num = 0;
                        assetGraph.findRelations({
                            from: asset,
                            to: {isLoaded: true}
                        }, true).forEach(function (outgoingRelation) {
                            outgoingRelation.href = outgoingRelation.href.replace(/\?.*$/, '') + '?md5=' + outgoingRelation.to.md5Hex;
                            num += 1;
                        });
                        if (num > 0) {
                            asset.markDirty();
                        }
                        cb(null, asset);
                    });
            });
    }
});

app.use(function (req, res, next) {
    getPopulatedAsset(req.url, function (err, asset) {
        if (err) {
            return res.send(404, {stack: err.stack});
        }
        sendAsset(asset, req, res, next);
    });
});

app.listen(3000);
