
// Initialize NPM libraries
var Parse = require('babyparse');
var async = require('async');

// Initialize tools
var tools = './../tools/'
var Shopify = require(tools+'shopify');
var FTP = require(tools+'ftp');

// Functions ===================================================================

// Get Products Map
function getProductsMap (next) {
	console.log('Making products map...');

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			Shopify.setup(function (err, shopify) {
				callback(err, shopify);
			})
		},

		// Get all products from Shopify
		function (shopify, callback) {
			Shopify.getAllProducts({
				'client': shopify,
				'fields': "id,variants"
			}, function (err, products) {
				callback(err, products);
			})
		},

		// Create map of products, save in localStorage
		function (products, callback) {
			var map = {};
			for (var i in products) {
				for (var j in products[i].variants) {
					map[products[i].variants[j].sku] = {
						'id': products[i].variants[j].id,
						'quantity': products[i].variants[j].inventory_quantity
					};
				}
			}
			callback(null, map);
		},

	], function (err, map) {
		next(err, map);
	})
};

// Handle Inventory File
function handleInventoryFile ({file, map}, next) {
	console.log('Handling inventory file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify server
		function (callback) {
			Shopify.setup(function (err, shopify) {
				callback(err, shopify);
			});
		},

		// Get updates from Shopify
		function (shopify, callback) {
			var updates = new Array();
			async.each(rows, function (row, callback) {

				// Initialize UPC
				var upc = row['(C)upc'];

				// Get saved variant
				var variant = map[upc];
				console.log(map);
				console.log(variant);

				// Get each variant
				Shopify.getVariant({
					'client': shopify,
					'id': variant.id,
				}, function (err, response) {
					conosle.log(response);
					if (response) updates.push({
						'id': variant.id,
					});
					callback(err);
				})
			}, function (err) {
				callback(err, shopify, updates);
			});
		},

		// Make updates on Shopify
		function (shopify, updates, callback) {
			console.log(updates);
			// async.each(updates, function (update, callback) {
			// 	Shopify.updateVariant({
			//
			// 	}, function (err) {
			//
			// 	});
			// }, function (err) {
			// 	callback(err);
			// })
		},

		// Delete file from server
		function (callback) {

		},

	], function (err) {
		next(err);
	})



};

// Get Parsed CSVs from Directory: returns a formatted list of CSV files from an FTP directory
function getParsedCSVsFromDirectory (directory, next) {
	console.log('Getting parsed files from directory...');

	var output = new Array();

	async.waterfall([

		// Setup FTP client
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Get list of files
		function (ftp, callback) {
			FTP.list({
				'client': ftp,
				'directory': directory,
			}, function (err, list) {
				callback(err, ftp, list);
			})
		},

		// Iterate through list of files
		function (ftp, list, callback) {

			// Initialize output array
			var output = new Array();

			// For each item in list...
			async.each(list, function (item, callback) {

				// Skip over non .csv files without error
				if (!fileIsCSV(item)) return callback();

				// Setup FTP request
				var ftpRequest = {
					'client': ftp,
					'path': directory+item.name,
				};

				// Get FTP file as stream, then...
				FTP.get(ftpRequest, function (err, stream) {
					if (err) return callback(err);

					// Parse stream, then...
					parseStream(stream, function (err, data) {
						if (err) return callback(err);

						// Format file and add to output
						output.push({
							'path': directory+item.name,
							'data': data
						});
						callback();
					});

				});

			}, function (err) {
				callback(err, output);
			});
		},

	], function (err, output) {
		next(err, output);
	})
};

// Parse Stream: parses ReadableStream file into JSON
function parseStream (stream, next) {
	console.log('Parsing file...');

	// Initialize string
	var string = '';

	// Convert stream to string
	stream.on('data', chunk => string += chunk);

	// When finished, parse string
	stream.on('end', function () {
		Parse.parse(string, {
			header: true,
			error: function (err) {
				next(err);
			},
			complete: function (results) {
				next(null, results.data);
			},
		});
	});
};

// File Is CSV: checks if file is a CSV file
function fileIsCSV(file) {
	if (file.type != '-') return false;
	if (file.name.substring(file.name.length - 4) != '.csv') return false;
	return true;
};

// Exports =====================================================================
module.exports = {
	getProductsMap: function (next) {
		getProductsMap(next)
	},
	getFromDirectory: function (directory, next) {
		getParsedCSVsFromDirectory(directory, next)
	},
	handleInventory: function ({file, map}, next) {
		handleInventoryFile({file, map}, next)
	},
};
