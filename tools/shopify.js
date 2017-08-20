
// Initialize NPM libraries
var async = require('async');
var Shopify = require('shopify-api-node');
var moment = require('moment');

// Initialize tools
var tools = './../tools/'
var FTP = require(tools+'ftp');
var Files = require(tools+'files');

// Initialize config
var config = require('./../config');

// Functions ===================================================================

// Setup Shopify: makes a Shopify API client using config settings
function setupShopify (next) {
	console.log('Setting up Shopify client...');
	next(null, new Shopify({
		shopName: config.shopifyShopName,
		apiKey: config.shopifyAPIKey,
		password: config.shopifyPassword
	}));
};

// Getters
function getAllProducts({client, fields, pageSize}, next) {
	console.log('Getting all products...');

	// Initialize pageSize & output array
	if (!pageSize) pageSize = 20;
	if (!fields) fields = "id";
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Get count of products
		function (callback) {
			client.product.count()
				.then(function (productCount) {
					callback(null, productCount);
				})
				.catch(function (err) {
					callback(err);
				})
		},

		// Make exhaustive product queries based on count
		function (productCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < productCount;
			}, function (callback) {
				client.product.list({
					'fields': fields,
					'limit': pageSize,
					'page': Math.floor(count/pageSize)+1
				})
				.then(function (products) {
					for (var i in products) {
						output.push(products[i]);
						count++;
					}
					callback();
				})
				.catch(function (err) {
					callback(err);
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function getVariant ({client, id}, next) {
	console.log('Getting Shopify variant...');
	client.productVariant.get(id)
		.then(function (variant) {
			next(null, variant);
		})
		.catch(function (err) {
			next(err);
		});
};

function setVariant({client, update}, next) {
	console.log('Updating Shopify variant...');
	client.productVariant.update(update.id, update.params)
		.then(function (response) {
			next(null);
		})
		.catch(function (err) {
			next(err);
		})
};

function getOrdersSinceTimestamp(timestamp, next) {
	if (timestamp) console.log('Getting orders since '+timestamp+'...');
	else console.log('Getting orders since beginning...');

	// Initialize pageSize & output array
	var pageSize = 20;
	var fields = "id,name,email,phone,shipping_address,discount_codes,shipping_lines,total_tax,line_items";
	var output = new Array();

	// Waterfall
	async.waterfall([

		// Setup Shopify
		function (callback) {
			setupShopify(function (err, client) {
				callback(err, client);
			})
		},

		// Get count of orders
		function (client, callback) {

			// Setup config
			var config = {};
			if (timestamp) config.created_at_min = timestamp;

			// Make request
			client.order.count(config)
			.then(function (orderCount) {
				callback(null, client, orderCount);
			})
			.catch(function (err) {
				callback(err);
			})
		},

		// Make exhaustive order queries based on count
		function (client, orderCount, callback) {

			// Initialize count
			var count = 0;

			// Exhaust products based on count
			async.whilst(function () {
				return count < orderCount;
			}, function (callback) {

				// Setup config
				var config = {
					'fields': fields,
					'limit': pageSize,
					'page': Math.floor(count/pageSize)+1
				};
				if (timestamp) config.created_at_min = timestamp;

				// Make request
				client.order.list(config)
				.then(function (orders) {
					for (var i in orders) {
						output.push(orders[i]);
						count++;
					}
					callback();
				})
				.catch(function (err) {
					callback(err);
				})
			}, function (err) {
				callback(err)
			})
		}
	], function (err) {
		next(err, output);
	})
}

function handleInventoryFile ({file, map}, next) {
	console.log('Handling inventory file...');

	// Initialize rows
	var rows = file.data;

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
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
					getVariant({
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
				setVariant({
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

function makeProductsMap (next) {
	console.log('Making products map...');

	async.waterfall([

		// Setup Shopify client
		function (callback) {
			setupShopify(function (err, shopify) {
				callback(err, shopify);
			})
		},

		// Get all products from Shopify
		function (shopify, callback) {
			getAllProducts({
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

// Exports =====================================================================
module.exports = {
	setup: function (next) {
		setupShopify(next)
	},
	getAllProducts: function ({client, fields, pageSize}, next) {
		getAllProducts({client, fields, pageSize}, next)
	},
	getVariant: function ({client, id}, next) {
		getVariant({client, id}, next)
	},
	setVariant: function ({client, update}, next) {
		setVariant({client, update}, next)
	},
	handleInventoryFile: function ({file, map}, next) {
		handleInventoryFile({file, map}, next)
	},
	makeProductsMap: function (next) {
		makeProductsMap(next)
	},
	getOrdersSinceTimestamp: function (timestamp, next) {
		getOrdersSinceTimestamp(timestamp, next)
	},
}
