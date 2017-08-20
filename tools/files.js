
// Initialize NPM libraries
var Parse = require('babyparse');
var async = require('async');
var moment = require('moment');

// Initialize tools
var tools = './../tools/'
var Shopify = require(tools+'shopify');
var FTP = require(tools+'ftp');

// Functions ===================================================================

// Make Products Map
function makeProductsMap (next) {
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

		// Get variant from Shopify for each row in file, make updates array
		function (shopify, callback) {
			var updates = new Array();
			async.each(rows, function (row, callback) {

				// Initialize fields from row
				var upc = row['(C)upc'];
				var quantity = row['(E)quantity'];
				var price = row['(F)MiscFlag'];

				// Get variant from map
				var mapVariant = map[upc];

				// If variant is found in map...
				if (mapVariant) {

					// Get variant from Shopify
					Shopify.getVariant({
						'client': shopify,
						'id': mapVariant.id,
					}, function (err, variant) {

						// If variant is found on Shopify, push information into updates array
						if (variant) {

							// Create update config
							var update = {
								'id': variant.id,
								'upc': upc,
								'params': {
									'old_inventory_quantity': variant.inventory_quantity,
									'inventory_quantity': quantity,
									'compare_at_price': price,
								},
							};

							// Push into updates array
							updates.push(update);
						}

						// Callback to advance array
						callback(err);
					})
				} else {

					console.log(upc+' not found in saved inventory');

					// Callback to advance array
					callback();
				}

			}, function (err) {
				callback(err, shopify, updates);
			});
		},

		// Make updates on Shopify
		function (shopify, updates, callback) {
			async.each(updates, function (update, callback) {
				Shopify.setVariant({
					'client': shopify,
					'update': update,
				}, function (err) {
					if (!err) console.log(update.upc+' updated successfully!');
					callback(err);
				});
			}, function (err) {
				callback(err);
			})
		},

		// Setup FTP server
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Delete file from server
		function (ftp, callback) {
			FTP.delete({
				'client': ftp,
				'path': file.path
			}, function (err) {
				callback(err);
			});
		},

	], function (err) {
		next(err);
	})
};

function getTimestampFile (path, next) {

	async.waterfall([

		// Setup FTP client
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Get timestamp file, parse, if null or send current time
		function (ftp, callback) {
			FTP.get({
				'client': ftp,
				'path': path,
			}, function (err, timestampFile) {
				if (!timestamp) timestamp = moment.get('x');
				callback(err, timestamp);
			})
		}

	], function (err, timestamp) {
		next(err, timestamp);
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

				// Get FTP file as stream, then...
				FTP.get({
					'client': ftp,
					'path': directory+item.name,
				}, function (err, stream) {
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
	makeProductsMap: function (next) {
		makeProductsMap(next)
	},
	getFromDirectory: function (directory, next) {
		getParsedCSVsFromDirectory(directory, next)
	},
	handleInventory: function ({file, map}, next) {
		handleInventoryFile({file, map}, next)
	},
};
