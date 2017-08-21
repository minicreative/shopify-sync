
// Initialize NPM libraries
var Parse = require('babyparse');
var async = require('async');
var moment = require('moment');

// Initialize tools
var tools = './../tools/'
var Shopify = require(tools+'shopify');
var FTP = require(tools+'ftp');

// File Formats
function getOrderRow() {
	const orderObject = {
		orderNumber: {
			heading: 'PurchaseOrder',
		},
		name: {
			heading: 'Name',
		},
		name2: {
			heading: 'Name2',
		},
		address1: {
			heading: 'Address1',
		},
		address2: {
			heading: 'Address2',
		},
		city: {
			heading: 'City',
		},
		state: {
			heading: 'State',
		},
		zip: {
			heading: 'Zip',
		},
		phone: {
			heading: 'Phone#',
		},
		email: {
			heading: 'EmailAddress',
		},
		shipMethod: {
			heading: 'ShipMethod',
		},
		sku: {
			heading: 'SKU',
		},
		quantity: {
			heading: 'Qauntity',
		},
		price: {
			heading: 'PRICE',
		},
		shipCost: {
			heading: 'Freight',
		},
		tax: {
			heading: 'SalesTax',
		},
		promo: {
			heading: 'PromoCode',
		},
	};
	return JSON.parse(JSON.stringify(orderObject));
}

// Functions ===================================================================

function makeOrdersFile ({orders, path}, next) {
	console.log('Making orders file...');

	async.waterfall([

		// Populate data array
		function (callback) {

			// Setup data
			var data = new Array();

			// Add headers to data
			var headerObject = getOrderRow();
			var headers = [];
			for (var key in headerObject) headers.push(headerObject[key].heading);
			data.push(headers);

			// Add items to data
			for (var i in orders) {

				// Initialize order
				var order = orders[i];

				// Initialize shipping
				var shipping = order.shipping_lines[0];

				// Setup shipMethod
				var shipMethod = null;
				var shopifyShippingCode = shipping.source+shipping.code;
				switch (shopifyShippingCode) {
					case "ups01": shipMethod = "UPS Next Day Air"; break;
					case "ups02": shipMethod = "UPS 2nd Day Air"; break;
					case "ups03": shipMethod = "UPS Ground"; break;
					case "ups07": shipMethod = "UPS Worldwide Express"; break;
					case "ups08": shipMethod = "UPS Worldwide Expedited"; break;
					case "ups11": shipMethod = "UPS Standard"; break;
					case "ups12": shipMethod = "UPS 3 Day Select"; break;
					case "ups13": shipMethod = "UPS Next Day Air Saver"; break;
					case "ups14": shipMethod = "UPS Next Day Air Early A.M."; break;
					case "ups54": shipMethod = "UPS Worldwide Express Plus"; break;
					case "ups59": shipMethod = "UPS 2nd Day Air A.M."; break;
					case "ups65": shipMethod = "UPS Saver"; break;
					case "ups82": shipMethod = "UPS Today Standard"; break;
					case "ups83": shipMethod = "UPS Today Dedicated Courier"; break;
					case "ups85": shipMethod = "UPS Today Express"; break;
					case "ups86": shipMethod = "UPS Today Express Saver"; break;
				}

				// Setup promo information
				var promo = "";
				for (var j in order.discount_codes) {
					promo += order.discount_codes[j].code;
					if (j < order.discount_codes.length-1) promo += ","
				}

				// Iterate through order items
				for (var k in order.line_items) {

					// Initialize item
					var item = order.line_items[k];

					// Intialize row
					var line = getOrderRow();

					// Setup order number
					line.orderNumber.value = order.name;

					// Setup address & contact information
					line.name.value = order.shipping_address.first_name;
					line.name2.value = order.shipping_address.last_name;
					line.address1.value = order.shipping_address.address1;
					line.address2.value = order.shipping_address.address2;
					line.city.value = order.shipping_address.city;
					line.state.value = order.shipping_address.province;
					line.zip.value = order.shipping_address.zip;
					if (order.phone) line.phone.value = order.phone;
					line.email.value = order.email;

					// Setup ship method & freight
					line.shipMethod.value = shipMethod;
					line.shipCost.value = shipping.price;

					// Setup item information
					line.sku.value = item.sku.substring(1,12);
					line.quantity.value = item.quantity;
					line.price.value = item.price;

					// Setup tax & promo information
					line.tax.value = order.total_tax;
					line.promo.value = promo;

					// Push line into row, push row into data
					var row = [];
					for (var key in line) {
						if (line[key].value) row.push(line[key].value);
						else row.push("");
					}
					data.push(row);
				}
			}

			callback(null, data);
		},

		// Handle data with parser
		function (data, callback) {
			unparseData(data, function (err, file) {
				callback(err, file);
			})
		},

		// Setup FTP client
		function (file, callback) {
			FTP.setup(function (err, ftp) {
				callback(err, file, ftp);
			});
		},

		// Write FTP file
		function (file, ftp, callback) {
			FTP.write({
				'client': ftp,
				'path': path,
				'file': file,
			}, function (err) {
				callback(err);
			});
		},

	], function (err) {
		next(err);
	})
};

function getTimestamp ({path}, next) {
	console.log('Getting timestamp...');

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
			}, function (err, stream) {

				// If file found, convert stream to timestamp
				if (!err) {

					// Set timestamp to string
					var timestamp = '';

					// Convert stream to string
					stream.on('data', chunk => timestamp += chunk);

					// When finished, parse string
					stream.on('end', function () {
						callback(null, timestamp);
					});

				}

				// Otherwise, continue (file does not yet exist)
				else {
					callback();
				}
			})
		}

	], function (err, timestamp) {
		next(err, timestamp);
	})
};

function makeTimestamp ({path}, next) {
	console.log('Writing timestamp...');

	async.waterfall([

		// Setup FTP client
		function (callback) {
			FTP.setup(function (err, ftp) {
				callback(err, ftp);
			});
		},

		// Get timestamp file, parse, if null or send current time
		function (ftp, callback) {
			FTP.write({
				'client': ftp,
				'path': path,
				'file': moment().format(),
			}, function (err, stream) {
				callback(null);
			})
		}
	], function (err) {
		next(err);
	})
};

function getParsedCSVs ({path}, next) {
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
				'path': path,
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
					'path': path+item.name,
				}, function (err, stream) {
					if (err) return callback(err);

					// Parse stream, then...
					parseStream(stream, function (err, data) {
						if (err) return callback(err);

						// Format file and add to output
						output.push({
							'path': path+item.name,
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

function unparseData(data, next) {
	console.log('Unparsing file...');
	var output = "";
	for (var i in data) {
		for (var j in data[i]) {
			output += data[i][j]; if (j < data[i].length-1) output += ",";
		}
		output += "\n";
	}
	next(null, output);
};

function fileIsCSV(file) {
	if (file.type != '-') return false;
	if (file.name.substring(file.name.length - 4) != '.csv') return false;
	return true;
};

// Exports =====================================================================
module.exports = {
	getTimestamp: function ({path}, next) {
		getTimestamp({path}, next)
	},
	makeTimestamp: function ({path}, next) {
		makeTimestamp({path}, next)
	},
	getParsedCSVs: function ({path}, next) {
		getParsedCSVs({path}, next)
	},
	makeOrdersFile: function ({orders, path}, next) {
		makeOrdersFile({orders, path}, next)
	},
};
